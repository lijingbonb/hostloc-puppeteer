const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const TelegramBot = require('node-telegram-bot-api');
const { format } = require('date-fns');

// 添加stealth插件
puppeteer.use(StealthPlugin());

// 加载环境变量
const isLocal = process.env.NODE_ENV === 'test';
if (isLocal) {
  require('dotenv').config();
}

// 初始化日志收集器
const logs = [];
let startTime = new Date();

// 初始化Telegram机器人
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
let bot = null;

if (telegramToken && chatId) {
  bot = new TelegramBot(telegramToken, { polling: false });
  console.log('Telegram 机器人已初始化');
} else {
  console.warn('Telegram 环境变量未设置，推送功能已禁用');
}

// 增强的日志函数（收集日志并可选推送到Telegram）
async function log(message, sendTelegram = false) {
  const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
  const logMessage = `[${timestamp}] ${message}`;
  
  // 添加到日志收集器
  logs.push(logMessage);
  console.log(logMessage);
  
  // 实时推送到Telegram（如果指定）
  if (sendTelegram && bot) {
    try {
      await bot.sendMessage(chatId, logMessage);
    } catch (error) {
      console.error('Telegram 实时推送失败:', error.message);
    }
  }
}

// 发送完整日志到Telegram
async function sendLogsToTelegram() {
  if (!bot || logs.length === 0) return;
  
  try {
    // 计算运行时间
    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);
    
    // 创建日志摘要
    const summary = logs
      .filter(log => log.includes('成功') || log.includes('失败') || log.includes('错误'))
      .join('\n');
    
    // 创建完整报告
    const report = `
📊 *任务报告*
⏱️ 运行时长: ${duration} 秒
📝 日志条目: ${logs.length} 条

📋 *关键摘要*
${summary}

📂 *完整日志*
完整日志请查看下方文件⬇️
    `;
    
    // 发送摘要
    await bot.sendMessage(chatId, report, { parse_mode: 'Markdown' });
    
    // 创建日志文件内容
    const logContent = logs.join('\n');
    
    // 将日志作为文件发送（避免消息过长）
    await bot.sendDocument(chatId, Buffer.from(logContent), {}, {
      filename: `hostloc-logs-${format(startTime, 'yyyyMMdd-HHmmss')}.txt`,
      contentType: 'text/plain'
    });
    
    log('✅ 日志已成功发送到 Telegram');
  } catch (error) {
    console.error('发送日志到 Telegram 失败:', error.message);
  }
}

(async () => {
  let browser;
  try {
    startTime = new Date();
    logs.length = 0; // 清空日志
    
    // 从环境变量获取登录凭证
    const username = process.env.HOSTLOC_USERNAME;
    const password = process.env.HOSTLOC_PASSWORD;

    if (!username || !password) {
      throw new Error('请设置 HOSTLOC_USERNAME 和 HOSTLOC_PASSWORD 环境变量');
    }

    // 本地测试时显示浏览器
    log(`运行模式: ${isLocal ? '本地测试' : '生产环境'}`);
    await log('🚀 开始执行 hostloc 自动任务', true);

    // 启动浏览器
    log('启动浏览器...');
    browser = await puppeteer.launch({
      headless: !isLocal,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
      ],
      ...(isLocal ? { slowMo: 50 } : {}),
    });
    
    const page = await browser.newPage();
    
    // 设置更长的超时时间
    await page.setDefaultNavigationTimeout(120000); // 120秒

    // 访问hostloc并登录
    log('访问hostloc论坛...');
    await page.goto('https://hostloc.com/forum-45-1.html', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    log('输入用户名和密码...');
    await page.type('#ls_username', username);
    await page.type('#ls_password', password);
    
    log('提交登录表单...');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 })
    ]);

    // 检查用户空间链接是否存在以确认登录成功
    log('验证登录状态...');
    const loggedIn = await page.evaluate(() => {
      return !!document.querySelector('a[href^="space-uid-"][title="访问我的空间"]');
    });
    
    if (!loggedIn) {
      // 尝试截图帮助调试
      if (isLocal) {
        await page.screenshot({ path: 'login-failure.png' });
        log('已保存登录失败截图: login-failure.png');
      }
      throw new Error('登录失败，未找到用户空间链接');
    }
    
    await log('✅ 登录成功!', true);

    // 访问用户空间
    await log('🔄 开始随机访问20个用户空间...', true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < 20; i++) {
      const randomUid = Math.floor(Math.random() * 31210) + 1;
      const userUrl = `https://www.hostloc.com/space-uid-${randomUid}.html`;
      
      log(`访问用户空间 #${i+1}: UID-${randomUid}`);
      
      try {
        await page.goto(userUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 15000
        });
        successCount++;
        log(`  访问成功: ${userUrl}`);
      } catch (error) {
        failCount++;
        log(`  访问失败: ${error.message}`);
      }
      
      // 随机延迟（10-15秒）
      const delay = Math.floor(Math.random() * 5000) + 10000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // 任务完成报告
    const report = `
✅ 任务完成!
=========================
成功访问: ${successCount} 次
失败访问: ${failCount} 次
总用时: ${Math.round((new Date() - startTime) / 1000)} 秒
=========================
`;
    
    await log(report, true);
    await browser.close();
    log('浏览器已关闭');

    // 发送完整日志到Telegram
    await sendLogsToTelegram();
    
    log('任务完成');

  } catch (error) {
    const errorMsg = `❌ 发生严重错误: ${error.message}`;
    await log(errorMsg, true);
    console.error(error);
    
    // 确保浏览器被关闭
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.error('关闭浏览器时出错:', e.message);
      }
    }
    
    // 发送错误日志到Telegram
    await sendLogsToTelegram();
    
    process.exit(1);
  }
})();
