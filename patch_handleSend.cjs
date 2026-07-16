const fs = require('fs');
let code = fs.readFileSync('src/components/RoundtableScreen.tsx', 'utf-8');

const targetStr = `    } else {
      if (stage === 'closing') {
        triggerNextPhilosopher();
      }
    }`;

const newStr = `    } else {
      if (stage === 'closing' || stage === 'free') {
        triggerNextPhilosopher();
      }
    }`;

code = code.replace(targetStr, newStr);

// Let's also add the useEffect for stage transition
const targetEffectStr = `  useEffect(() => {
    if (stage === 'free' && !isLoading && !isGeneratingRef.current && messages.length >= 2) {`;

const newEffectStr = `  useEffect(() => {
    if (stage === 'free' && messages.length > 0 && messages[messages.length - 1].role === 'user' && !isLoading && !isGeneratingRef.current) {
      // If we entered free stage or user spoke and we haven't triggered, do it
      // Actually, wait, handleSend will trigger it for 'free' stage. 
      // But if user spoke in 'opening' stage, it changed stage to 'free', and handleSend didn't trigger it.
      // So we trigger it here if it's the first response in free stage.
      const userSpokeLast = messages[messages.length - 1].role === 'user';
      if (userSpokeLast) {
         setTimeout(() => triggerNextPhilosopher(), 500);
      }
    }
    
    if (stage === 'free' && !isLoading && !isGeneratingRef.current && messages.length >= 2) {`;

code = code.replace(targetEffectStr, newEffectStr);

fs.writeFileSync('src/components/RoundtableScreen.tsx', code);
