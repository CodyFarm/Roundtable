const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const testEndpoint = `
  app.post("/api/test-connection", async (req, res) => {
    try {
      const config = getApiConfig(req);
      if (!config.key) {
        throw new Error("Missing API Key. Please provide an API Key.");
      }
      
      let message = "API Connection Successful";
      
      if (config.provider === 'openai' || config.provider === 'custom' || config.provider === 'deepseek') {
        let model = config.model || "gpt-4o";
        let baseURL = cleanBaseUrl(config.baseUrl);
        
        if (config.provider === 'deepseek') {
          if (!config.model) model = "deepseek-chat";
          if (!config.baseUrl) baseURL = "https://api.deepseek.com/v1";
        }
        
        const openai = new OpenAI({ apiKey: config.key, baseURL });
        await openai.chat.completions.create({
          model: model,
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 5,
        });
      } else if (config.provider === 'anthropic') {
        const anthropic = new Anthropic({ apiKey: config.key });
        await anthropic.messages.create({
          model: config.model || "claude-3-5-sonnet-20241022",
          max_tokens: 5,
          messages: [{ role: "user", content: "Hi" }]
        });
      } else {
        const ai = new GoogleGenAI({ apiKey: config.key });
        await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: "Hi",
          config: { maxOutputTokens: 5 }
        });
      }
      
      res.json({ success: true, message });
    } catch (error: any) {
      console.error("Test connection error:", error);
      // Try to extract useful message
      let msg = error.message;
      if (error.status === 401) {
        msg = "401 Unauthorized: Please check your API key.";
      }
      res.status(500).json({ error: msg });
    }
  });
`;

code = code.replace(
  '  // Vite middleware for development',
  testEndpoint + '\n  // Vite middleware for development'
);

fs.writeFileSync('server.ts', code);
