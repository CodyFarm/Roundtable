const fs = require('fs');
let code = fs.readFileSync('src/components/SetupScreen.tsx', 'utf-8');

const testStateStr = `  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');`;

code = code.replace(
  "  const [error, setError] = useState('');",
  "  const [error, setError] = useState('');\n" + testStateStr
);

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
    
    // Reset status after a few seconds if successful
    if (testStatus !== 'error') {
      setTimeout(() => {
        setTestStatus('idle');
        setTestMessage('');
      }, 5000);
    }
  };
`;

code = code.replace(
  "  const handleSavePhilosopher = () => {",
  testFuncStr + "\n  const handleSavePhilosopher = () => {"
);

fs.writeFileSync('src/components/SetupScreen.tsx', code);
