const fs = require('fs');
let code = fs.readFileSync('src/components/SetupScreen.tsx', 'utf-8');

const testButtonUI = `
              </div>
              
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testStatus === 'testing' || !apiKey}
                  className="px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {testStatus === 'testing' ? (
                    <div className="w-4 h-4 border-2 border-neutral-400 border-t-neutral-800 rounded-full animate-spin" />
                  ) : null}
                  {lang === 'zh' ? '测试连接' : 'Test Connection'}
                </button>
                {testMessage && (
                  <span className={\`text-xs font-medium \${testStatus === 'success' ? 'text-green-600' : testStatus === 'error' ? 'text-red-600' : 'text-neutral-500'}\`}>
                    {testMessage}
                  </span>
                )}
              </div>
`;

code = code.replace(
  "                </select>\n              </div>\n            </div>",
  "                </select>\n              </div>" + testButtonUI + "\n            </div>"
);

fs.writeFileSync('src/components/SetupScreen.tsx', code);
