const fs = require('fs');
let code = fs.readFileSync('src/components/SetupScreen.tsx', 'utf-8');

code = code.replace(/<\/select>\n              <\/div>\n              <\/div>/, "</select>\n              </div>");

fs.writeFileSync('src/components/SetupScreen.tsx', code);
