import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Helper to parse config. Falls back to server-side environment variables
  // when the frontend does not provide an API key, model, or base URL.
  const getApiConfig = (req: express.Request) => {
    const providerKeyEnv: Record<string, string | undefined> = {
      gemini: process.env.GEMINI_API_KEY,
      openai: process.env.OPENAI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
      deepseek: process.env.DEEPSEEK_API_KEY,
      custom: process.env.CUSTOM_API_KEY,
    };

    const providerModelEnv: Record<string, string | undefined> = {
      gemini: undefined,
      openai: process.env.OPENAI_API_MODEL,
      anthropic: process.env.ANTHROPIC_API_MODEL,
      deepseek: process.env.DEEPSEEK_API_MODEL,
      custom: process.env.CUSTOM_API_MODEL,
    };

    const providerBaseUrlEnv: Record<string, string | undefined> = {
      gemini: undefined,
      openai: process.env.OPENAI_API_BASE_URL,
      anthropic: undefined,
      deepseek: process.env.DEEPSEEK_API_BASE_URL,
      custom: process.env.CUSTOM_API_BASE_URL,
    };

    try {
      const configStr = req.headers["x-api-config"] as string;
      if (configStr) {
        const parsed = JSON.parse(configStr);
        const provider = parsed.provider || process.env.DEFAULT_API_PROVIDER || 'gemini';
        parsed.provider = provider;

        if (!parsed.key) {
          parsed.key = providerKeyEnv[provider];
        }
        if (!parsed.model && providerModelEnv[provider]) {
          parsed.model = providerModelEnv[provider];
        }
        if (!parsed.baseUrl && providerBaseUrlEnv[provider]) {
          parsed.baseUrl = providerBaseUrlEnv[provider];
        }

        return parsed;
      }
    } catch(e) {}

    const fallbackProvider = process.env.DEFAULT_API_PROVIDER || 'gemini';
    return {
      provider: fallbackProvider,
      key: providerKeyEnv[fallbackProvider],
      model: providerModelEnv[fallbackProvider],
      baseUrl: providerBaseUrlEnv[fallbackProvider],
    };
  };

  const retrieveRelevantChunks = (fileContent: string, query: string, maxChars: number = 1000): string => {
    if (!fileContent) return "";
    if (fileContent.length <= maxChars) return fileContent;

    // Split into paragraphs/chunks of reasonable size
    const paragraphs = fileContent.split(/\n\s*\n+/).map(p => p.trim()).filter(Boolean);
    if (paragraphs.length <= 1) {
      // fallback if there are no double line breaks: split by single lines or sentences
      const lines = fileContent.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length <= 1) {
        return fileContent.substring(0, maxChars);
      }
      return lines.slice(0, 15).join("\n");
    }

    // Tokenize query into words/keywords (Chinese characters or English words)
    const keywords = query
      .toLowerCase()
      .split(/[\s,，.。!！?？;；:：""''()（）[\]{}【】\-_]+/g)
      .filter(w => w.length >= 2); // only keep keywords of length >= 2

    if (keywords.length === 0) {
      return paragraphs.slice(0, 3).join("\n\n").substring(0, maxChars);
    }

    // Score each paragraph based on keyword matches
    const scoredParagraphs = paragraphs.map(p => {
      const pLower = p.toLowerCase();
      let score = 0;
      keywords.forEach(kw => {
        if (pLower.includes(kw)) {
          score += 1;
          const matches = pLower.split(kw).length - 1;
          score += matches * 0.5;
        }
      });
      return { text: p, score };
    });

    // Sort by score in descending order
    scoredParagraphs.sort((a, b) => b.score - a.score);

    // Reconstruct retrieved text up to maxChars
    let result = "";
    for (const item of scoredParagraphs) {
      if (item.score === 0 && result.length > 0) break; // don't add irrelevant chunks if we already have some text
      if (result.length + item.text.length + 2 > maxChars) {
        if (result.length === 0) {
          result = item.text.substring(0, maxChars);
        }
        break;
      }
      result += (result ? "\n\n" : "") + item.text;
    }

    return result || fileContent.substring(0, maxChars);
  };

  const cleanBaseUrl = (url: string | undefined) => {
    if (!url) return undefined;
    let clean = url.trim().replace(/\/+$/, '');
    if (clean.endsWith('/chat/completions')) {
      clean = clean.replace(/\/chat\/completions$/, '');
    }
    // Only append /v1 if it doesn't already have it and isn't a custom path format like /api/paas/v4
    if (!clean.match(/\/v\d+$/) && !clean.includes('/v1/')) {
      clean += '/v1';
    }
    return clean;
  };

  const getSystemInstruction = (topic: string, currentStage: string, philosophers: any[], language: string, lastMessageContent: string = "") => {
    const isZh = language === 'zh';

    // Support either object format or string fallback for robustness
    const names = philosophers.map(p => {
      if (typeof p === 'string') return p;
      return isZh ? p.name : p.nameEn;
    }).join(", ");

    const customPrompts = philosophers.map(p => {
      if (typeof p === 'string') return '';
      const name = isZh ? p.name : p.nameEn;
      let refContent = "";
      if (p.fileContent) {
        // Retrieve relevant parts of the uploaded reference material to save tokens
        const query = `${topic} ${lastMessageContent}`;
        refContent = retrieveRelevantChunks(p.fileContent, query, 1000);
      }

      if (p.customPrompt || refContent) {
        return `\nInformation & Persona instructions for ${name}:
${p.customPrompt || ''}
${refContent ? `Relevant reference text from their works/writings:\n"""\n${refContent}\n"""\nWhen highly relevant to the topic, quote directly from your reference text to support your arguments (aim for roughly half the time). (When quoting from the reference text, please use markdown blockquotes and include the chapter or section name if inferable, for example:\n> "Quote..." \n— *Chapter/Section Name*)` : ''}`;
      }
      return '';
    }).filter(Boolean).join("\n");

    return `You are an orchestrator simulating a philosophical roundtable discussion.
Topic: "${topic}"
Stage: ${currentStage} (Opening statements, Free debate, or Closing statements)
Philosophers present: ${names}.

${customPrompts}

Based on the conversation history, you need to generate the next response from ONE of the philosophers.
CRITICAL: The 'speaker' value MUST exactly match one of the names in the list of philosophers present: [${names}]. You are STRICTLY FORBIDDEN from choosing any other philosopher (such as Sam Harris or any external philosopher) or introducing anyone else to the debate.
If 'targetPhilosopher' is provided, you MUST generate a response for that philosopher.
Otherwise, choose the philosopher who would most logically respond next (someone who was just mentioned, disagreed with, or hasn't spoken in a while).
Keep responses in character, concise (around 150-200 words), and directly engaging with the previous points.
CRITICAL INSTRUCTIONS:
1. Please generate ALL your responses in ${isZh ? 'Chinese' : 'English'}.
2. If Stage is 'Opening statements', the speaker MUST briefly introduce themselves and their core philosophy before stating their basic perspective on the topic.
Also, analyze the relationship of this new message to previous messages (e.g., agreeing with X, disagreeing with Y) for a mind map.`;
  };

  const getSocraticInstruction = (topic: string, language: string) => `Based on the current discussion about "${topic}", generate 3 Socratic, thought-provoking questions that the user could ask to deepen the debate. Keep them concise. Generate questions in ${language === 'zh' ? 'Chinese' : 'English'}.`;

  const generateChatGemini = async (config: any, prompt: string, instruction: string) => {
    if (!config.key) {
      throw new Error("Missing API Key. Please provide a Gemini API Key in the setup screen, or configure the GEMINI_API_KEY environment variable.");
    }
    const ai = new GoogleGenAI({
      apiKey: config.key,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: instruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            speaker: { type: Type.STRING, description: "Name of the philosopher speaking." },
            content: { type: Type.STRING, description: "Content of their speech." },
            nextEagerSpeaker: { type: Type.STRING, description: "Name of the philosopher who is most eager to respond next, if any." },
            relations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, description: "'agree', 'disagree', 'supplement', 'question'" },
                  target: { type: Type.STRING, description: "Name of the person they are responding to" }
                }
              }
            }
          },
          required: ["speaker", "content", "relations"]
        }
      },
    });
    const parsed = JSON.parse(response.text || "{}");
    parsed.tokensUsed = response.usageMetadata?.totalTokenCount;
    return parsed;
  };

  const extractJson = (text: string) => {
    try {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      return JSON.parse(match ? match[1] : text);
    } catch (e) {
      console.error("Failed to parse JSON:", text);
      return {};
    }
  };

  const generateChatOpenAI = async (config: any, prompt: string, instruction: string) => {
    if (!config.key) {
      throw new Error("Missing API Key. Please provide an API Key in the setup screen.");
    }

    let model = config.model || "gpt-4o";
    let baseURL = cleanBaseUrl(config.baseUrl);

    if (config.provider === 'deepseek') {
      if (!config.model) model = "deepseek-chat";
      if (!config.baseUrl) baseURL = "https://api.deepseek.com/v1";
    }

    const openai = new OpenAI({
      apiKey: config.key,
      baseURL: baseURL,
    });

    let inst = instruction;
    const reqBody: any = {
      model: model,
      messages: [
        { role: "system", content: inst },
        { role: "user", content: prompt + "\n\nRespond strictly with a JSON object containing { speaker, content, nextEagerSpeaker (optional), relations: [{type, target}] }. Do not include any other text." }
      ]
    };

    if (config.thinkingDepth) {
      if (model.startsWith('o1') || model.startsWith('o3')) {
        let effort = 'medium';
        if (config.thinkingDepth === 'low') effort = 'low';
        else if (config.thinkingDepth === 'high' || config.thinkingDepth === 'extra-high') effort = 'high';
        reqBody.reasoning_effort = effort;
      } else {
        reqBody.messages[1].content += `\n\nThink deeply: depth level ${config.thinkingDepth}.`;
      }
    }

    if (model.startsWith('o1')) {
      // o1 does not support system role in older APIs, but let's assume it's supported or fallback to developer
      reqBody.messages[0].role = "developer";
    }

    const response = await openai.chat.completions.create(reqBody);
    const parsed = extractJson(response.choices[0].message.content || "{}");
    parsed.tokensUsed = response.usage?.total_tokens;
    return parsed;
  };

  const generateChatAnthropic = async (config: any, prompt: string, instruction: string) => {
    if (!config.key) {
      throw new Error("Missing API Key. Please provide an Anthropic API Key in the setup screen.");
    }
    const anthropic = new Anthropic({ apiKey: config.key });
    let model = config.model || "claude-3-5-sonnet-20241022";
    let thinkingConfig: any = undefined;
    let maxTokens = 1500;

    if (config.thinkingDepth && model === 'claude-3-7-sonnet-20250219') {
      let budget = 4000;
      if (config.thinkingDepth === 'low') budget = 2000;
      if (config.thinkingDepth === 'high') budget = 8000;
      if (config.thinkingDepth === 'extra-high') budget = 16000;
      thinkingConfig = { type: "enabled", budget_tokens: budget };
      maxTokens = budget + 2000;
    }

    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: instruction,
      thinking: thinkingConfig,
      messages: [
        { role: "user", content: prompt + "\n\nRespond strictly with a JSON object containing { speaker, content, nextEagerSpeaker (optional), relations: [{type, target}] }. Do not include any other text." }
      ]
    });
    const text = response.content.filter(c => c.type === 'text').map((c: any) => c.text).join("");
    const parsed = extractJson(text || "{}");
    parsed.tokensUsed = response.usage?.output_tokens;
    return parsed;
  };

  app.post("/api/chat", async (req, res) => {
    try {
      const { topic, philosophers, messages, currentStage, targetPhilosopher } = req.body;
      const config = getApiConfig(req);
      const language = (req.headers["x-app-language"] as string) || "zh";

      const lastMessage = messages && messages.length > 0 ? messages[messages.length - 1] : null;
      const lastMessageContent = lastMessage ? lastMessage.content : "";

      const instruction = getSystemInstruction(topic, currentStage, philosophers, language, lastMessageContent);
      const formattedMessages = messages.map((m: any) => `[${m.role === "user" ? "User/Participant" : m.author}]: ${m.content}`).join("\n");
      const recentSpeakers = messages.slice(-4).map((m: any) => m.author).filter((a: string) => a !== "User/Participant" && a !== "主持人");

      const prompt = `Current conversation:\n${formattedMessages}\n\nRecent speakers: ${recentSpeakers.join(", ")}. If 'auto-select', try NOT to pick someone who just spoke unless absolutely necessary.\n\nTarget next speaker: ${targetPhilosopher || "auto-select"}\nGenerate the next response.`;

      let data;
      if (config.provider === 'openai' || config.provider === 'custom' || config.provider === 'deepseek') {
        data = await generateChatOpenAI(config, prompt, instruction);
      } else if (config.provider === 'anthropic') {
        data = await generateChatAnthropic(config, prompt, instruction);
      } else {
        data = await generateChatGemini(config, prompt, instruction);
      }
      res.json(data);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/socratic", async (req, res) => {
    try {
      const { topic, messages } = req.body;
      const config = getApiConfig(req);
      const language = (req.headers["x-app-language"] as string) || "zh";
      const prompt = getSocraticInstruction(topic, language) + "\n\n" + messages.slice(-5).map((m: any) => `[${m.author}]: ${m.content}`).join("\n");

      let questions = [];
      if (!config.key) {
        throw new Error("Missing API Key. Please provide an API Key in the setup screen, or configure the environment variable.");
      }
      if (config.provider === 'openai' || config.provider === 'custom' || config.provider === 'deepseek') {
        let model = config.model || "gpt-4o";
        let baseURL = cleanBaseUrl(config.baseUrl);
        if (config.provider === 'deepseek' && !config.model) model = "deepseek-chat";
        if (config.provider === 'deepseek' && !config.baseUrl) baseURL = "https://api.deepseek.com/v1";

        const openai = new OpenAI({ apiKey: config.key, baseURL });
        const response = await openai.chat.completions.create({
          model: model,
          messages: [
            { role: "user", content: prompt + "\n\nRespond strictly with a JSON object containing an array of strings under the key 'questions'. Do not include any other text." }
          ]
        });
        questions = extractJson(response.choices[0].message.content || "{}").questions || [];
      } else if (config.provider === 'anthropic') {
        const anthropic = new Anthropic({ apiKey: config.key });
        const response = await anthropic.messages.create({
          model: config.model || "claude-3-5-sonnet-20241022",
          max_tokens: 500,
          messages: [
            { role: "user", content: prompt + "\n\nRespond strictly with a JSON object containing an array of strings under the key 'questions'. Do not include any other text." }
          ]
        });
        const textResponse = response.content.filter(c => c.type === 'text').map((c: any) => c.text).join("");
        questions = extractJson(textResponse || "{}").questions || [];
      } else {
        const ai = new GoogleGenAI({ apiKey: config.key });
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        });
        questions = JSON.parse(response.text || "[]");
      }
      res.json({ questions });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/toc", async (req, res) => {
    try {
      const { text, language } = req.body;
      const config = getApiConfig(req);

      const prompt = `Please analyze the following book/text and extract or generate a concise Table of Contents (Chapters/Sections). Format it as a simple markdown list. If the text is very short, just return a single section summary. Generate in ${language === 'zh' ? 'Chinese' : 'English'}.\n\nText snippet (first 100000 characters):\n${text.substring(0, 100000)}`;

      let tocText;
      if (!config.key) {
        throw new Error("Missing API Key. Please provide an API Key in the setup screen.");
      }

      if (config.provider === 'openai' || config.provider === 'custom' || config.provider === 'deepseek') {
        let model = config.model || "gpt-4o";
        let baseURL = cleanBaseUrl(config.baseUrl);
        if (config.provider === 'deepseek' && !config.model) model = "deepseek-chat";
        if (config.provider === 'deepseek' && !config.baseUrl) baseURL = "https://api.deepseek.com/v1";

        const openai = new OpenAI({ apiKey: config.key, baseURL });
        const response = await openai.chat.completions.create({
          model: model,
          messages: [{ role: "user", content: prompt }]
        });
        tocText = response.choices[0].message.content;
      } else if (config.provider === 'anthropic') {
        const anthropic = new Anthropic({ apiKey: config.key });
        const response = await anthropic.messages.create({
          model: config.model || "claude-3-5-sonnet-20241022",
          max_tokens: 1000,
          messages: [
            { role: "user", content: prompt }
          ]
        });
        tocText = response.content.filter(c => c.type === 'text').map((c: any) => c.text).join("");
      } else {
        const ai = new GoogleGenAI({ apiKey: config.key });
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
        });
        tocText = response.text;
      }
      res.json({ toc: tocText });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });


  app.post("/api/summary", async (req, res) => {
    try {
      const { topic, messages } = req.body;
      const config = getApiConfig(req);
      const language = (req.headers["x-app-language"] || "zh");

      const formattedMessages = messages.map((m) => `[${m.author}]: ${m.content}`).join("\n");
      const prompt = `Based on the following debate on the topic "${topic}", please provide a summary.\nFor each philosopher, summarize:\n1. Their updated core viewpoint.\n2. Which specific parts of the opponents' viewpoints they are criticizing.\nFormat as clean Markdown. Generate in ${language === 'zh' ? 'Chinese' : 'English'}.\n\nDebate History:\n${formattedMessages}`;

      let summaryText;
      if (!config.key) {
        throw new Error("Missing API Key.");
      }
      if (config.provider === 'openai' || config.provider === 'custom' || config.provider === 'deepseek') {
        let model = config.model || "gpt-4o";
        let baseURL = cleanBaseUrl(config.baseUrl);
        if (config.provider === 'deepseek' && !config.model) model = "deepseek-chat";
        if (config.provider === 'deepseek' && !config.baseUrl) baseURL = "https://api.deepseek.com/v1";

        const openai = new OpenAI({ apiKey: config.key, baseURL });
        const response = await openai.chat.completions.create({
          model: model,
          messages: [{ role: "user", content: prompt }]
        });
        summaryText = response.choices[0].message.content;
      } else if (config.provider === 'anthropic') {
        const anthropic = new Anthropic({ apiKey: config.key });
        const response = await anthropic.messages.create({
          model: config.model || "claude-3-5-sonnet-20241022",
          max_tokens: 1500,
          messages: [
            { role: "user", content: prompt }
          ]
        });
        summaryText = response.content.filter(c => c.type === 'text').map((c: any) => c.text).join("");
      } else {
        const ai = new GoogleGenAI({ apiKey: config.key });
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
        });
        summaryText = response.text;
      }
      res.json({ summary: summaryText });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/followup", async (req, res) => {
    try {
      const { philosopher, content, topic, userFollowUpInput } = req.body;
      const config = getApiConfig(req);
      const language = (req.headers["x-app-language"] as string) || "zh";
      const prompt = `You are ${philosopher}. You previously said or are being asked about: "${content}" in a discussion about "${topic}". The user is pressing you for a deeper, more detailed explanation or has raised a new point: "${userFollowUpInput}". Give a profound, slightly longer, and very in-character defense or elaboration of your point in ${language === 'zh' ? 'Chinese' : 'English'}.`;

      let text;
      let tokensUsed;
      if (!config.key) {
        throw new Error("Missing API Key. Please provide an API Key in the setup screen, or configure the environment variable.");
      }
      if (config.provider === 'openai' || config.provider === 'custom' || config.provider === 'deepseek') {
        let model = config.model || "gpt-4o";
        let baseURL = cleanBaseUrl(config.baseUrl);
        if (config.provider === 'deepseek' && !config.model) model = "deepseek-chat";
        if (config.provider === 'deepseek' && !config.baseUrl) baseURL = "https://api.deepseek.com/v1";

        const openai = new OpenAI({ apiKey: config.key, baseURL });
        const response = await openai.chat.completions.create({
          model: model,
          messages: [{ role: "user", content: prompt }]
        });
        text = response.choices[0].message.content;
        tokensUsed = response.usage?.total_tokens;
      } else if (config.provider === 'anthropic') {
        const anthropic = new Anthropic({ apiKey: config.key });
        const response = await anthropic.messages.create({
          model: config.model || "claude-3-5-sonnet-20241022",
          max_tokens: 1000,
          messages: [
            { role: "user", content: prompt }
          ]
        });
        text = response.content.filter(c => c.type === 'text').map((c: any) => c.text).join("");
        tokensUsed = response.usage?.output_tokens;
      } else {
        const ai = new GoogleGenAI({ apiKey: config.key });
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
        });
        text = response.text;
        tokensUsed = response.usageMetadata?.totalTokenCount;
      }
      res.json({ content: text, tokensUsed });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

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

  return app;
}
