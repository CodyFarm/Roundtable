const fs = require('fs');
let code = fs.readFileSync('src/components/RoundtableScreen.tsx', 'utf-8');

code = code.replace(
  'const triggerNextPhilosopher = async (target?: string) => {',
  'const triggerNextPhilosopher = async (target?: string) => {\n    if (isGeneratingRef.current) return;\n    isGeneratingRef.current = true;'
);

code = code.replace(
  'setIsLoading(false);',
  'setIsLoading(false);\n      isGeneratingRef.current = false;'
);

code = code.replace(
  'setMessages(prev => [...prev, newMessage]);',
  `setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.author === data.speaker && lastMsg.role === 'philosopher') {
          // Check similarity
          const words1 = new Set(lastMsg.content.split(/[\\s,\\uff0c\\.\\u3002!\\uff01\\?\\uff1f]+/));
          const words2 = new Set(data.content.split(/[\\s,\\uff0c\\.\\u3002!\\uff01\\?\\uff1f]+/));
          const intersection = new Set([...words1].filter(x => words2.has(x)));
          const union = new Set([...words1, ...words2]);
          const score = intersection.size / (union.size || 1);
          
          if (score > 0.7 || lastMsg.content.includes(data.content) || data.content.includes(lastMsg.content)) {
            // Too similar, discard new message
            return prev;
          } else if (score > 0.3) {
            // Somewhat similar, merge
            const merged = { ...lastMsg, content: lastMsg.content + '\\n\\n' + data.content };
            return [...prev.slice(0, -1), merged];
          }
        }
        return [...prev, newMessage];
      });`
);

fs.writeFileSync('src/components/RoundtableScreen.tsx', code);
