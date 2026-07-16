const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const followupAnthropic = `      } else if (config.provider === 'anthropic') {
        const anthropic = new Anthropic({ apiKey: config.key });
        const response = await anthropic.messages.create({
          model: config.model || "claude-3-5-sonnet-20241022",
          max_tokens: 1000,
          messages: [
            { role: "user", content: prompt }
          ]
        });
        text = response.content.filter(c => c.type === 'text').map((c: any) => c.text).join("");
        tokensUsed = response.usage?.output_tokens;
      } else {`;

code = code.replace(
  /        tokensUsed = response\.usage\?\.total_tokens;\n      \} else \{/,
  `        tokensUsed = response.usage?.total_tokens;\n${followupAnthropic}`
);

fs.writeFileSync('server.ts', code);
