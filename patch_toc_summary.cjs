const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const tocAnthropic = `      } else if (config.provider === 'anthropic') {
        const anthropic = new Anthropic({ apiKey: config.key });
        const response = await anthropic.messages.create({
          model: config.model || "claude-3-5-sonnet-20241022",
          max_tokens: 1000,
          messages: [
            { role: "user", content: prompt }
          ]
        });
        tocText = response.content.filter(c => c.type === 'text').map((c: any) => c.text).join("");
      } else {`;

code = code.replace(
  /        tocText = response\.choices\[0\]\.message\.content;\n      \} else \{/,
  `        tocText = response.choices[0].message.content;\n${tocAnthropic}`
);

const summaryAnthropic = `      } else if (config.provider === 'anthropic') {
        const anthropic = new Anthropic({ apiKey: config.key });
        const response = await anthropic.messages.create({
          model: config.model || "claude-3-5-sonnet-20241022",
          max_tokens: 1500,
          messages: [
            { role: "user", content: prompt }
          ]
        });
        summaryText = response.content.filter(c => c.type === 'text').map((c: any) => c.text).join("");
      } else {`;

code = code.replace(
  /        summaryText = response\.choices\[0\]\.message\.content;\n      \} else \{/,
  `        summaryText = response.choices[0].message.content;\n${summaryAnthropic}`
);

fs.writeFileSync('server.ts', code);
