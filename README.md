# SMTP2HTTP - Railway 云部署版

将 SMTP 邮箱转换为 HTTP API，支持多邮箱轮询。

## Railway 部署步骤

### 1. 注册 Railway
访问 https://railway.app，用 GitHub 登录

### 2. 新建项目
- 点击 "New Project"
- 选择 "Deploy from GitHub repo"
- 导入这个仓库

### 3. 配置环境变量
在项目设置中添加环境变量：

```
API_TOKEN=smtp2http_7e_2026_secure_token
SMTP_HOST=smtp.qiye.aliyun.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_ACCOUNTS=[{"id":"ai1","email":"ai1@636.ltd","user":"ai1@636.ltd","pass":"Aa123123123.","quota":500},{"id":"ai2","email":"ai2@636.ltd","user":"ai2@636.ltd","pass":"Aa123123123.","quota":500}]
```

### 4. 部署
Railway 会自动构建和部署，完成后获得一个 HTTPS 地址，如：
`https://smtp2http-production-xxx.up.railway.app`

### 5. 测试
```bash
curl https://your-app.up.railway.app/health
```

## API 使用

### 发送邮件
```bash
curl -X POST https://your-app.up.railway.app/email \
  -H "Authorization: Bearer smtp2http_7e_2026_secure_token" \
  -H "Content-Type: application/json" \
  -d '{
    "to": ["recipient@example.com"],
    "subject": "测试邮件",
    "html": "<h1>Hello</h1>"
  }'
```

### 查看统计
```bash
curl -H "Authorization: Bearer smtp2http_7e_2026_secure_token" \
  https://your-app.up.railway.app/stats
```

## 免费额度

Railway 提供 $5/月免费额度，足够运行这个服务。
