# Hostloc Puppeteer 自动化脚本并推送至telegram Bot

## 最新更新
- 使用更稳定的元素选择器 `input[name="username"]` 和 `input[name="password"]`
- 集成测试和生产环境到单个文件 `index.js`
- 添加详细的日志记录功能
- 支持环境变量配置（本地开发使用 `.env`，CI使用secrets）
- 强制无头模式在CI环境中运行
- 修复了各种兼容性问题

## 使用说明
1. 安装依赖：`npm install`
2. 本地运行：`npm start`
3. 测试运行：`npm test`

## 环境变量
- `USERNAME`: 论坛用户名
- `PASSWORD`: 论坛密码
- TELEGRAM_BOT_TOKEN: 机器人token
- TELEGRAM_CHAT_ID: 你的tgid

## GitHub Actions
工作流文件已配置为自动执行脚本
