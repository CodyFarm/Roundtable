const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const socraticAnthropic = `      } else if (config.provider === 'anthropic') {
        const anthropic = new Anthropic({ apiKey: config.key });
        const response = await anthropic.messages.create({
          model: config.model || "claude-3-5-sonnet-20241022",
          max_tokens: 500,
          messages: [
            { role: "user", content: prompt + "\\n\\nRespond strictly with a JSON object containing an array of strings under the key 'questions'. Do not include any other text." }
          ]
        });
        const textResponse = response.content.filter(c => c.type === 'text').map((c: any) => c.text).join("");
        questions = extractJson(textResponse || "{}").questions || [];
      } else {`;

code = code.replace(
  /        questions = extractJson\(response\.choices\[0\]\.message\.content \|\| "\{\}"\)\.questions \|\| \[\];\n      \} else \{/,
  `        questions = extractJson(response.choices[0].message.content || "{}").questions || [];\n${socraticAnthropic}`
);

fs.writeFileSync('server.ts', code);
