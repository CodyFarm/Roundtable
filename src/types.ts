export type Stage = 'setup' | 'opening' | 'free' | 'closing' | 'chat';
export type Role = 'host' | 'participant';
export type ApiProvider = 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'custom';
export type Language = 'zh' | 'en';
export type SessionMode = 'debate' | 'chat';

export interface ApiConfig {
  provider: ApiProvider;
  key: string;
  baseUrl?: string;
  model?: string;
  thinkingDepth?: 'low' | 'medium' | 'high' | 'extra-high';
}

export interface Philosopher {
  id: string;
  name: string;
  nameEn: string;
  avatarUrl?: string;
  description: string;
  descriptionEn: string;
  color: string;
  isCustom?: boolean;
  isShared?: boolean;
  sharedBy?: string;
  createdBy?: string;
  customPrompt?: string;
  fileContent?: string;
}

export interface Relation {
  type: 'agree' | 'disagree' | 'supplement' | 'question';
  target: string;
  detail?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'philosopher';
  author: string; // "Host", "Participant", or Philosopher's name
  content: string;
  stage: Stage;
  relations?: Relation[];
  timestamp: number;
  nextEagerSpeaker?: string;
  tokensUsed?: number;
}

export const PRESET_PHILOSOPHERS: Philosopher[] = [
  { id: 'plato', name: '柏拉图', nameEn: 'Plato', description: '古希腊哲学家，理念论的奠基人', descriptionEn: 'Ancient Greek philosopher, founder of the theory of Forms', color: '#3b82f6' },
  { id: 'aristotle', name: '亚里士多德', nameEn: 'Aristotle', description: '古希腊哲学家，逻辑学与经验主义先驱', descriptionEn: 'Ancient Greek philosopher, pioneer of logic and empiricism', color: '#eab308' },
  { id: 'kant', name: '康德', nameEn: 'Immanuel Kant', description: '德国古典哲学创始人，批判哲学体系', descriptionEn: 'German philosopher, founder of critical philosophy', color: '#8b5cf6' },
  { id: 'nietzsche', name: '尼采', nameEn: 'Friedrich Nietzsche', description: '德国哲学家，权力意志与超人学说', descriptionEn: 'German philosopher, will to power and Übermensch', color: '#ef4444' },
  { id: 'confucius', name: '孔子', nameEn: 'Confucius', description: '中国儒家学派创始人', descriptionEn: 'Founder of the Chinese Confucian school of thought', color: '#10b981' },
  { id: 'descartes', name: '笛卡尔', nameEn: 'René Descartes', description: '法国哲学家，"我思故我在"', descriptionEn: 'French philosopher, "I think, therefore I am"', color: '#06b6d4' },
  { id: 'sartre', name: '萨特', nameEn: 'Jean-Paul Sartre', description: '法国存在主义代表人物', descriptionEn: 'Key figure in French existentialism', color: '#f97316' },
  { id: 'marx', name: '马克思', nameEn: 'Karl Marx', description: '历史唯物主义与科学共产主义创始人', descriptionEn: 'Founder of historical materialism', color: '#dc2626' },
];


export interface Summary {
  id: string;
  messageIndex: number;
  text: string;
  title: string;
}

export interface SavedSession {
  id: string;
  name: string;
  date: string;
  topic: string;
  philosophers: Philosopher[];
  stage: Stage;
  messages: Message[];
  summaries: Summary[];
  mode: SessionMode;
}

// ── Auth & Account ─────────────────────────────────────────────────────

export interface UserInfo {
  id: string;
  username: string;
  token: string;
}

export interface SharedPhilosopherEntry {
  id: string;
  userId: string;
  username: string;
  philosopher: Philosopher;
  createdAt: string;
}

export interface SharedSessionEntry {
  id: string;
  userId: string;
  username: string;
  session: SavedSession;
  createdAt: string;
}
