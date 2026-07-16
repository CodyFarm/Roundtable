const fs = require('fs');
let code = fs.readFileSync('src/components/SetupScreen.tsx', 'utf-8');

const testFuncStr = `
  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage(lang === 'zh' ? '正在测试连接...' : 'Testing connection...');
    
    try {
      const response = await fetch('/api/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-config': JSON.stringify({ provider: apiProvider, key: apiKey, baseUrl: apiBaseUrl, model: apiModel })
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setTestStatus('success');
        setTestMessage(lang === 'zh' ? '连接成功！' : 'Connection successful!');
      } else {
        setTestStatus('error');
        setTestMessage(data.error || (lang === 'zh' ? '连接失败' : 'Connection failed'));
      }
    } catch (e: any) {
      setTestStatus('error');
      setTestMessage(e.message || (lang === 'zh' ? '网络错误' : 'Network error'));
    }
    
    if (testStatus !== 'error') {
      setTimeout(() => {
        setTestStatus('idle');
        setTestMessage('');
      }, 5000);
    }
  };
`;

code = code.replace(
  "  const handleSubmit = (e: React.FormEvent) => {",
  testFuncStr + "\n  const handleSubmit = (e: React.FormEvent) => {"
);

fs.writeFileSync('src/components/SetupScreen.tsx', code);
