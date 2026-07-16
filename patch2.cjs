const fs = require('fs');
let code = fs.readFileSync('src/components/RoundtableScreen.tsx', 'utf-8');

const additionalEffect = `
  // Auto-trigger next philosopher if user just @-mentioned someone and they replied
  useEffect(() => {
    if (stage === 'free' && !isLoading && !isGeneratingRef.current && messages.length >= 2) {
      const lastMsg = messages[messages.length - 1];
      const secondLast = messages[messages.length - 2];
      if (
        lastMsg.role === 'philosopher' && 
        secondLast.role === 'user' && 
        secondLast.content.includes('@')
      ) {
        // We give it a tiny delay to ensure state updates have flushed, though it's optional
        setTimeout(() => triggerNextPhilosopher(), 500);
      }
    }
  }, [stage, messages.length, isLoading]);
`;

code = code.replace(
  'const triggerNextPhilosopher = async (target?: string) => {',
  additionalEffect + '\n  const triggerNextPhilosopher = async (target?: string) => {'
);

fs.writeFileSync('src/components/RoundtableScreen.tsx', code);
