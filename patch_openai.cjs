const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const oldCode = `    const openai = new OpenAI({
      apiKey: config.key,
      baseURL: cleanBaseUrl(config.baseUrl),
    });
    
    let model = config.model || "gpt-4o";
    if (config.provider === 'deepseek' && !config.model) {
      model = "deepseek-chat";
      if (!config.baseUrl) openai.baseURL = "https://api.deepseek.com/v1";
    }`;

const newCode = `    let model = config.model || "gpt-4o";
    let baseURL = cleanBaseUrl(config.baseUrl);
    
    if (config.provider === 'deepseek') {
      if (!config.model) model = "deepseek-chat";
      if (!config.baseUrl) baseURL = "https://api.deepseek.com/v1";
    }

    const openai = new OpenAI({
      apiKey: config.key,
      baseURL: baseURL,
    });`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('server.ts', code);
