const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// The botched part is between:
// } else if (config.provider === 'anthropic') { 
// ...
// } else {
//   data = await generateChatGemini(config, prompt, instruction);
// }

// Let's replace the whole block from the end of if (config.provider === 'openai'...) to data = await generateChatGemini...
// wait, the if statement is:
/*
      if (config.provider === 'openai' || config.provider === 'custom' || config.provider === 'deepseek') {
        data = await generateChatOpenAI(config, prompt, instruction);
      } else if (config.provider === 'anthropic') {
        data = await generateChatAnthropic(config, prompt, instruction);
      } else if (config.provider === 'anthropic') { ... } 
      ...
      } else {
        data = await generateChatGemini(config, prompt, instruction);
      }
*/

const badStartStr = `      } else if (config.provider === 'anthropic') {
        const anthropic = new Anthropic({ apiKey: config.key });
        const response = await anthropic.messages.create({
          model: config.model || "claude-3-5-sonnet-20241022",
          max_tokens: 500,`;

const badEndStr = `        text = response.content.filter(c => c.type === 'text').map(c => c.text).join("");
        tokensUsed = response.usage?.output_tokens;
}`;

const startIndex = code.indexOf(badStartStr);
const endIndex = code.indexOf(badEndStr) + badEndStr.length;

if (startIndex !== -1 && endIndex !== -1) {
  code = code.slice(0, startIndex) + code.slice(endIndex);
}

fs.writeFileSync('server.ts', code);
