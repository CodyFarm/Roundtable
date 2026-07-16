const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(/}} else {/g, '} else {');
code = code.replace(/} else if \(config\.provider === 'anthropic'\) {\s*data = await generateChatAnthropic\(config, prompt, instruction\);\s*} else {/g, 
`} else if (config.provider === 'anthropic') {
        data = await generateChatAnthropic(config, prompt, instruction);
      } else {`);

fs.writeFileSync('server.ts', code);
