/**
 * SMTP2HTTP - Railway 云部署版
 * 
 * 配置方式：环境变量
 * - SMTP_ACCOUNTS: JSON 格式的邮箱配置
 * - API_TOKEN: API 认证 token
 * 
 * Railway 部署：
 * 1. railway login
 * 2. railway init
 * 3. railway up
 */

const express = require('express')
const nodemailer = require('nodemailer')

const app = express()
app.use(express.json())

// ========== 环境变量配置 ==========

const API_TOKEN = process.env.API_TOKEN || 'smtp2http_default_token'
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.qiye.aliyun.com'
const SMTP_PORT = parseInt(process.env.SMTP_PORT) || 465
const SMTP_SECURE = process.env.SMTP_SECURE !== 'false'

// 从环境变量解析邮箱配置
let ACCOUNTS = []
try {
  if (process.env.SMTP_ACCOUNTS) {
    ACCOUNTS = JSON.parse(process.env.SMTP_ACCOUNTS)
  }
} catch (e) {
  console.error('[ERROR] SMTP_ACCOUNTS 解析失败:', e.message)
}

console.log(`[CONFIG] 加载了 ${ACCOUNTS.length} 个邮箱账户`)
console.log(`[CONFIG] SMTP服务器: ${SMTP_HOST}:${SMTP_PORT}`)

// 每日发送计数
const dailyCount = {}

// ========== 认证中间件 ==========

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { message: '缺少认证信息', type: 'unauthorized' } })
  }
  
  const token = authHeader.slice(7)
  if (token !== API_TOKEN) {
    return res.status(401).json({ error: { message: '认证失败', type: 'unauthorized' } })
  }
  
  next()
}

// ========== 邮箱选择 ==========

function selectAccount() {
  const today = new Date().toISOString().split('T')[0]
  
  const available = ACCOUNTS.filter(account => {
    const key = `${today}:${account.id}`
    const sent = dailyCount[key] || 0
    return sent < account.quota
  })
  
  if (available.length === 0) return null
  
  // 发送量最少的优先
  available.sort((a, b) => {
    const aSent = dailyCount[`${today}:${a.id}`] || 0
    const bSent = dailyCount[`${today}:${b.id}`] || 0
    return aSent - bSent
  })
  
  return available[0]
}

// ========== 发送邮件 ==========

async function sendEmail(account, { from, to, subject, html, text }) {
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: account.user, pass: account.pass }
  })
  
  return transporter.sendMail({
    from: from || account.email,
    to: Array.isArray(to) ? to.join(',') : to,
    subject,
    html,
    text
  })
}

// ========== API 路由 ==========

app.get('/health', (req, res) => {
  const today = new Date().toISOString().split('T')[0]
  const available = ACCOUNTS.filter(account => {
    const key = `${today}:${account.id}`
    return (dailyCount[key] || 0) < account.quota
  })
  
  res.json({
    status: 'ok',
    version: '1.0.0',
    smtp: `${SMTP_HOST}:${SMTP_PORT}`,
    accounts: ACCOUNTS.length,
    available: available.length,
    timestamp: new Date().toISOString()
  })
})

app.post('/email', authMiddleware, async (req, res) => {
  const { from, to, subject, html, text } = req.body
  
  if (!to || (Array.isArray(to) && to.length === 0)) {
    return res.status(400).json({ error: { message: '收件人地址必填' } })
  }
  if (!subject) {
    return res.status(400).json({ error: { message: '邮件主题必填' } })
  }
  if (!html && !text) {
    return res.status(400).json({ error: { message: '邮件内容必填' } })
  }
  
  const startTime = Date.now()
  const errors = []
  const tried = new Set()
  
  while (tried.size < ACCOUNTS.length) {
    const account = selectAccount()
    if (!account) break
    if (tried.has(account.id)) continue
    tried.add(account.id)
    
    try {
      await sendEmail(account, { from, to, subject, html, text })
      
      const today = new Date().toISOString().split('T')[0]
      const key = `${today}:${account.id}`
      dailyCount[key] = (dailyCount[key] || 0) + 1
      
      console.log(`[SUCCESS] ${account.email} -> ${Array.isArray(to) ? to.join(',') : to}`)
      
      return res.json({
        id: `email_${Date.now()}`,
        from: from || account.email,
        to,
        created_at: new Date().toISOString(),
        account: account.email,
        duration: Date.now() - startTime
      })
    } catch (err) {
      console.error(`[FAILED] ${account.email}: ${err.message}`)
      errors.push({ account: account.email, error: err.message })
    }
  }
  
  if (errors.length > 0) {
    return res.status(500).json({ error: { message: '发送失败', details: errors } })
  }
  
  res.status(503).json({ error: { message: '没有可用邮箱' } })
})

app.get('/stats', authMiddleware, (req, res) => {
  const today = new Date().toISOString().split('T')[0]
  
  const accounts = ACCOUNTS.map(account => {
    const key = `${today}:${account.id}`
    const sent = dailyCount[key] || 0
    return { id: account.id, email: account.email, sent, quota: account.quota, remaining: account.quota - sent }
  })
  
  const total = accounts.reduce((s, a) => s + a.sent, 0)
  const totalQuota = accounts.reduce((s, a) => s + a.quota, 0)
  
  res.json({
    today: { date: today, total_sent: total, total_quota: totalQuota, remaining: totalQuota - total, accounts }
  })
})

// Railway 端口
const PORT = process.env.PORT || 3000
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[OK] SMTP2HTTP 运行在端口 ${PORT}`)
  console.log(`[OK] 邮箱数: ${ACCOUNTS.length}`)
})
