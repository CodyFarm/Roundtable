# 哲学人的圆桌 · Philosopher's Roundtable

AI 驱动的虚拟哲学家圆桌辩论平台。

让柏拉图、康德、尼采、孔子等哲学大师围绕你选定的话题展开一场结构化的多轮辩论。你可以作为旁观者、参与者或主持人介入讨论，也能创建自定义哲学家并上传参考资料来塑造他们的观点。

---

## ✨ 功能亮点

- **🤖 结构化多阶段辩论** — 开场陈述 → 自由辩论 → 总结陈词，AI 逐轮生成哲学家发言，保持角色一致性和话题聚焦
- **🎭 8 位预设哲学家** — 柏拉图、亚里士多德、康德、尼采、孔子、笛卡尔、萨特、马克思，每位都有中英文名称、简介和专属配色
- **🧙 自定义哲学家** — 自由创建哲学家，设定中英文名称、描述、提示词，支持上传 TXT / Markdown / PDF 参考资料
- **📄 PDF 与文档解析** — 上传参考资料后自动提取文本，AI 可生成内容概要（Table of Contents）
- **🔍 智能参考资料检索** — AI 发言时自动从上传资料中提取最相关段落（关键词加权评分算法），控制上下文预算在 1000 字符以内
- **☁️ 多 LLM 后端支持** — 支持 Google Gemini、OpenAI（GPT-4o / o1 / o3）、Anthropic Claude、DeepSeek 及任意兼容 OpenAI `/v1/chat/completions` 的自定义端点
- **🧠 思考深度控制** — 低 / 中 / 高 / 极高四档，映射为 Claude 的 thinking budget 或 OpenAI o1/o3 的 reasoning effort
- **🌐 双语界面** — 完整中英文 UI，随时切换
- **👤 用户认证系统** — 用户名 + 密码注册登录，邀请码保护，scrypt 密码哈希，Bearer Token 会话（30 天有效）
- **📤 共享哲学家池** — 登录用户可将自定义哲学家上传到服务器端共享池，其他用户可查看和使用
- **☁️ 云端会话同步** — 登录后可保存/恢复云端会话；也支持本地 localStorage 存储
- **📊 辩论总结** — AI 生成的辩论摘要，结构化展示每位哲学家的当前观点与批评
- **💡 苏格拉底式追问** — AI 生成 3 个发人深省的问题来深化辩论
- **🔗 追问按钮** — 对任意哲学家发言点击"追问"，触发独立 `/api/followup` 端点生成角色化回应
- **🗺️ 思维导图 / 关系标记** — AI 为每条发言标注同意 / 反对 / 补充 / 质疑关系，以彩色徽章展示
- **⚡ 急欲发言机制** — AI 可标记哪位哲学家"急于发言"，主持人点击即可让其登场
- **@提及定向** — 输入 `@哲学家名字` 直接向特定哲学家提问
- **⬇️ 对话下载** — 导出完整辩论记录为 TXT 文件
- **📐 可调整面板** — 左侧参与者列表和右侧侧边栏均可拖拽调整宽度

---

## 🛠️ 技术栈

| 层 | 技术 |
|---|------|
| **前端** | React 19 + TypeScript, Vite 6, Tailwind CSS 4, Motion (Framer Motion), Lucide React, react-markdown, pdfjs-dist |
| **后端** | Express.js 4 + TypeScript, tsx (开发), esbuild (生产打包) |
| **AI SDK** | `@google/genai`, `openai`, `@anthropic-ai/sdk`（懒加载以兼容 Vercel serverless） |
| **数据存储** | 基于文件的 JSON 存储（`data/` 目录）+ 浏览器 localStorage |

---

## 📁 项目结构

```
PhilosopherRoundtable/
├── index.html                  # SPA 入口
├── server.ts                   # Express + Vite 开发/生产服务器
├── vite.config.ts              # Vite 配置
├── tsconfig.json               # TypeScript 配置
├── package.json                # 依赖与脚本
├── .env.example                # 环境变量模板
│
├── api/
│   ├── server-routes.ts        # 主要 API 路由
│   │   ├── /api/chat           # 生成下一位哲学家发言
│   │   ├── /api/socratic       # 生成苏格拉底式问题
│   │   ├── /api/toc            # AI 生成参考资料概要
│   │   ├── /api/summary        # 生成辩论总结
│   │   ├── /api/followup       # 处理追问
│   │   ├── /api/test-connection# 测试 API 连接
│   │   ├── /api/auth/*         # 注册 / 登录 / 获取用户信息
│   │   ├── /api/philosophers/* # 共享哲学家 CRUD
│   │   └── /api/sessions/*     # 云端会话保存/恢复
│   └── data-layer.ts           # JSON 文件数据层
│
├── src/
│   ├── main.tsx                # React 入口
│   ├── App.tsx                 # 根组件（状态管理 + 路由）
│   ├── types.ts                # 全局类型定义
│   └── components/
│       ├── SetupScreen.tsx     # 设置页（话题、哲学家选择、API 配置等）
│       ├── RoundtableScreen.tsx# 辩论页（三栏布局、消息、输入等）
│       └── AuthModal.tsx       # 登录/注册弹窗
│
├── data/                       # 服务端 JSON 数据
│   ├── users.json
│   ├── tokens.json
│   ├── invitation_codes.json
│   ├── shared_philosophers.json
│   └── shared_sessions.json
│
└── assets/                     # 静态资源
```

---

## 🚀 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) >= 18
- 至少一个 LLM 提供商的 API Key（Gemini / OpenAI / Anthropic / DeepSeek 或兼容端点）

### 安装与运行

```bash
# 1. 克隆仓库
git clone <your-repo-url>
cd PhilosopherRoundtable

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填入你选择的 AI 服务商的 API Key

# 4. 启动开发服务器
npm run dev
# 浏览器打开 http://localhost:3000
```

### 生产打包

```bash
npm run build   # Vite 构建前端 + esbuild 打包后端
npm run start   # 启动生产服务器：node dist/server.cjs
```

---

## 🔧 环境变量

| 变量 | 说明 |
|------|------|
| `DEFAULT_API_PROVIDER` | 默认 AI 提供商（gemini / openai / anthropic / deepseek / custom） |
| `GEMINI_API_KEY` | Google Gemini API 密钥 |
| `OPENAI_API_KEY` | OpenAI API 密钥 |
| `OPENAI_API_MODEL` | OpenAI 模型（默认 `gpt-4o`） |
| `OPENAI_API_BASE_URL` | 自定义 OpenAI 基础 URL |
| `ANTHROPIC_API_KEY` | Anthropic API 密钥 |
| `ANTHROPIC_API_MODEL` | Anthropic 模型 |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 |
| `DEEPSEEK_API_MODEL` | DeepSeek 模型 |
| `DEEPSEEK_API_BASE_URL` | DeepSeek 基础 URL |
| `CUSTOM_API_KEY` | 自定义提供商 API 密钥 |
| `CUSTOM_API_MODEL` | 自定义提供商模型名 |
| `CUSTOM_API_BASE_URL` | 自定义提供商基础 URL |
| `APP_URL` | 应用部署地址 |

---

---

# Philosopher's Roundtable · 哲学人的圆桌

An AI-powered virtual roundtable debate platform featuring history's greatest philosophers.

Choose a philosophical topic, select from Plato, Kant, Nietzsche, Confucius, and more — then watch as the AI orchestrates a structured, multi-stage debate. You can observe, participate, or act as the host guiding the conversation. Create custom philosophers and upload reference materials to shape their perspectives.

## ✨ Features

- **🤖 Structured Multi-Stage Debates** — Opening Statements → Free Debate → Closing Statements. The AI generates philosopher responses one at a time, maintaining character and topic focus
- **🎭 8 Preset Philosophers** — Plato, Aristotle, Kant, Nietzsche, Confucius, Descartes, Sartre, and Marx, each with bilingual names, descriptions, and distinct colors
- **🧙 Custom Philosophers** — Create philosophers with custom names, descriptions, and prompt instructions. Upload reference materials as TXT, Markdown, or PDF files
- **📄 PDF & Document Parsing** — Uploaded reference files are automatically parsed (PDF via `pdfjs-dist`). An AI-generated Table of Contents summarizes uploaded content
- **🔍 Smart Reference Retrieval** — During debate, the AI retrieves the most relevant portions of uploaded materials using a keyword-weighted paragraph scoring algorithm, capped at 1,000 characters to save tokens
- **☁️ Multi-Provider LLM Support** — Google Gemini, OpenAI (GPT-4o / o1 / o3), Anthropic Claude, DeepSeek, and any custom OpenAI-compatible endpoint
- **🧠 Thinking Depth Control** — Low / Medium / High / Extra-High, mapping to Claude's thinking budget or OpenAI o1/o3's reasoning effort
- **🌐 Bilingual Interface** — Full Chinese and English UI, toggleable at any time
- **👤 User Authentication** — Register and login with username + password, protected by invitation codes. Uses `crypto.scryptSync` for password hashing with per-user salt. Bearer token sessions (30-day expiry)
- **📤 Shared Philosopher Pool** — Logged-in users can share custom philosophers to a server-side pool visible to all users, who can then use them in their own debates
- **☁️ Cloud Session Sync** — Logged-in users can save and restore debate sessions to the cloud. Local `localStorage` storage is also supported
- **📊 Debate Summaries** — AI-generated summaries giving a structured breakdown of each philosopher's current stance and criticisms
- **💡 Socratic Question Generation** — AI generates 3 thought-provoking questions to deepen the debate
- **🔗 Follow-Up Questions** — Click "Follow up" on any philosopher's message for an in-character deeper response via the dedicated `/api/followup` endpoint
- **🗺️ Mind Map / Relations** — AI tags each message with structural relations (agree / disagree / supplement / question), displayed as colored badges and in the right sidebar
- **⚡ Eager Speaker Mechanism** — The AI can indicate which philosopher is eager to speak next, allowing the host to call on them
- **@Mention Targeting** — Type `@PhilosopherName` to directly address a specific philosopher
- **⬇️ Download Chat History** — Export the full debate as a downloadable `.txt` file
- **📐 Resizable Panels** — Both the left sidebar (participants) and right sidebar (socratic questions / relations) are drag-resizable

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19 + TypeScript, Vite 6, Tailwind CSS 4, Motion (Framer Motion), Lucide React, react-markdown, pdfjs-dist |
| **Backend** | Express.js 4 + TypeScript, tsx (dev), esbuild (production bundle) |
| **AI SDKs** | `@google/genai`, `openai`, `@anthropic-ai/sdk` (lazy-loaded for Vercel serverless compatibility) |
| **Storage** | File-based JSON storage (`data/` directory) + browser localStorage |

## 📁 Project Structure

```
PhilosopherRoundtable/
├── index.html                  # SPA entry point
├── server.ts                   # Express + Vite dev/prod server
├── vite.config.ts              # Vite configuration
├── tsconfig.json               # TypeScript configuration
├── package.json                # Dependencies & scripts
├── .env.example                # Environment variable template
│
├── api/
│   ├── server-routes.ts        # Main API routes
│   │   ├── /api/chat           # Generate next philosopher response
│   │   ├── /api/socratic       # Generate Socratic questions
│   │   ├── /api/toc            # AI-generate reference content summary
│   │   ├── /api/summary        # Generate debate summary
│   │   ├── /api/followup       # Handle follow-up questions
│   │   ├── /api/test-connection# Test API key validity
│   │   ├── /api/auth/*         # Register / Login / Get user info
│   │   ├── /api/philosophers/* # Shared philosopher CRUD
│   │   └── /api/sessions/*     # Cloud session save/restore
│   └── data-layer.ts           # JSON file-based data layer
│
├── src/
│   ├── main.tsx                # React entry point
│   ├── App.tsx                 # Root component (state management + routing)
│   ├── types.ts                # Global type definitions
│   └── components/
│       ├── SetupScreen.tsx     # Setup page (topic, philosopher selection, API config)
│       ├── RoundtableScreen.tsx# Debate page (3-column layout, messages, input)
│       └── AuthModal.tsx       # Login/Register modal
│
├── data/                       # Server-side JSON data store
│   ├── users.json
│   ├── tokens.json
│   ├── invitation_codes.json
│   ├── shared_philosophers.json
│   └── shared_sessions.json
│
└── assets/                     # Static assets
```

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- At least one LLM provider API key (Gemini / OpenAI / Anthropic / DeepSeek, or a compatible endpoint)

### Install & Run

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd PhilosopherRoundtable

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local
# Edit .env.local and add your chosen AI provider's API key

# 4. Start the dev server
npm run dev
# Open http://localhost:3000 in your browser
```

### Production Build

```bash
npm run build   # Vite builds frontend + esbuild bundles backend
npm run start   # Start production server: node dist/server.cjs
```

## 🔧 Environment Variables

| Variable | Description |
|----------|-------------|
| `DEFAULT_API_PROVIDER` | Default AI provider (gemini / openai / anthropic / deepseek / custom) |
| `GEMINI_API_KEY` | Google Gemini API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_API_MODEL` | OpenAI model (default: `gpt-4o`) |
| `OPENAI_API_BASE_URL` | Custom OpenAI base URL |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `ANTHROPIC_API_MODEL` | Anthropic model |
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `DEEPSEEK_API_MODEL` | DeepSeek model |
| `DEEPSEEK_API_BASE_URL` | DeepSeek base URL |
| `CUSTOM_API_KEY` | Custom provider API key |
| `CUSTOM_API_MODEL` | Custom provider model name |
| `CUSTOM_API_BASE_URL` | Custom provider base URL |
| `APP_URL` | App hosting URL |

