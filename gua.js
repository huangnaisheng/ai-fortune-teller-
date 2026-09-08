const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});


const CONFIG_FILE = path.join(__dirname, 'config.json');
const API_URL = 'https://api.deepseek.com/chat/completions';

// 赛博起卦函数
function generateHexagram() {
    const posNames = ["初爻(底)", "二爻    ", "三爻    ", "四爻    ", "五爻    ", "上爻(顶)"];
    let hexagramLines = [];

    for (let i = 0; i < 6; i++) {
        const sum = crypto.randomInt(2, 4) + crypto.randomInt(2, 4) + crypto.randomInt(2, 4);
        let name, symbol, isChanging;
        if (sum === 6) { name = "老阴"; symbol = "▅▅ ▅▅"; isChanging = true; }
        else if (sum === 7) { name = "少阳"; symbol = "▅▅▅▅▅"; isChanging = false; }
        else if (sum === 8) { name = "少阴"; symbol = "▅▅ ▅▅"; isChanging = false; }
        else if (sum === 9) { name = "老阳"; symbol = "▅▅▅▅▅"; isChanging = true; }

        hexagramLines.push(`${posNames[i]}  ${symbol}  ${name}(${sum}) ${isChanging ? " <-- 动爻" : ""}`);
    }
    return hexagramLines.reverse().join('\n');
}

// 封装 readline 提问为 Promise，让代码逻辑更扁平
function askUser(query) {
    return new Promise(resolve => readline.question(query, resolve));
}


async function askDeepSeek(apiKey, question, hexagram) {
    console.log("\n[系统提示] 正在连接 DeepSeek 赛博算命服务器，请稍候...\n");
    
    const payload = {
        model: "deepseek-chat",
        messages: [
            { role: "system", content: "你是一个精通《易经》的占卜大师。我会提供我心中的疑问以及起卦得到的六爻卦象。请你根据卦象，结合我的问题，用通俗易懂、带有玄学风格的语言为我解卦。" },
            { role: "user", content: `我的问题是：\n${question}\n\n起卦结果如下：\n${hexagram}` }
        ],
        temperature: 0.7 
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (data.choices && data.choices.length > 0) {
            let answer = data.choices[0].message.content;
            // 去除大模型的 Markdown 标记，保持黑框纯净
            answer = answer.replace(/\*\*/g, '').replace(/#+\s/g, '');
            
            console.log("====================================");
            console.log("         AI 大师解卦结果报告        ");
            console.log("====================================");
            console.log(answer);
            console.log("\n====================================");
        } else {
            console.error("\n[API 错误] 返回异常，可能是 API Key 填错了，或者账户余额不足。");
            console.error("排查建议：您可以删除同目录下的 config.json 文件，重新运行程序输入正确的 Key。");
        }
    } catch (error) {
        console.error("\n[网络错误] 请求失败，请检查网络连接或代理设置。");
    }
}

// 主流程控制
async function main() {
    let apiKey = '';

    // 1. 处理 API Key 逻辑
    if (fs.existsSync(CONFIG_FILE)) {
        // 读取已存在的配置
        try {
            const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            apiKey = config.apiKey;
        } catch (e) {
            console.error("读取 config.json 失败，请直接删除该文件后重试。");
            process.exit(1);
        }
    } else {
        // 第一次启动，要求输入并保存
        console.log("【首次启动配置】");
        apiKey = await askUser("请输入你的 DeepSeek API Key (sk-...): ");
        apiKey = apiKey.trim();
        
        if (!apiKey) {
            console.log("API Key 不能为空，程序退出。");
            process.exit(1);
        }
        
        // 写入本地配置文件
        fs.writeFileSync(CONFIG_FILE, JSON.stringify({ apiKey: apiKey }, null, 4));
        console.log("✅ API Key 已安全保存在本地 config.json 中！\n");
    }

    // 2. 算卦交互逻辑
    const question = await askUser('请输入你心中想问的问题 (例如：明天抽卡能出货吗？): ');
    
    if (question.trim()) {
        const hexagram = generateHexagram();
        console.log("\n【你的卦象】\n" + hexagram);
        await askDeepSeek(apiKey, question, hexagram);
    } else {
        console.log("问题不能为空。");
    }

    // 3. 阻塞退出
    await askUser('\n卦象解读完毕。按【回车键】退出...');
    readline.close();
}

// 启动程序
main();