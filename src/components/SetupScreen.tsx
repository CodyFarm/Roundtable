import { useState, useEffect, useRef } from 'react';
import { Philosopher, PRESET_PHILOSOPHERS, ApiConfig, ApiProvider, Language, SavedSession, Message, Summary, Stage } from '../types';
import { Settings, Users, MessageSquareQuote, Globe, Plus, Edit2, X, Upload, Trash2, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as pdfjsLib from 'pdfjs-dist';

// Use a public CDN for the worker to avoid Vite configuration issues
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface Props {
  onStart: (topic: string, philosophers: Philosopher[], apiConfig: ApiConfig, language: Language, restoreSessionId?: string, restoreMessages?: Message[], restoreSummaries?: Summary[], restoreStage?: Stage, restoreName?: string) => void;
  initialApiConfig: ApiConfig;
  initialLanguage: Language;
}

export default function SetupScreen({ onStart, initialApiConfig, initialLanguage }: Props) {
  const [topic, setTopic] = useState('');
  
  const [apiProvider, setApiProvider] = useState<ApiProvider>(initialApiConfig.provider || 'gemini');
  const [apiKey, setApiKey] = useState(initialApiConfig.key || '');
  const [apiBaseUrl, setApiBaseUrl] = useState(initialApiConfig.baseUrl || '');
  const [apiModel, setApiModel] = useState(initialApiConfig.model || '');
  const [thinkingDepth, setThinkingDepth] = useState<'low' | 'medium' | 'high' | 'extra-high' | undefined>(initialApiConfig.thinkingDepth);
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(['plato', 'kant', 'nietzsche']));
  const [error, setError] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [lang, setLang] = useState<Language>(initialLanguage);
  
  const [customPhilosophers, setCustomPhilosophers] = useState<Philosopher[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Partial<Philosopher>>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [cpName, setCpName] = useState('');
  const [cpNameEn, setCpNameEn] = useState('');
  const [cpDesc, setCpDesc] = useState('');
  const [cpDescEn, setCpDescEn] = useState('');
  const [cpPrompt, setCpPrompt] = useState('');
  const [cpFileContent, setCpFileContent] = useState('');
  const [cpFileName, setCpFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  useEffect(() => {
    const saved = localStorage.getItem('saved_sessions');
    if (saved) {
      try {
        setSavedSessions(JSON.parse(saved));
      } catch(e) {}
    }
  }, []);
  
  const restoreSession = (s: SavedSession) => {
    onStart(s.topic, s.philosophers, { provider: apiProvider, key: apiKey, baseUrl: apiBaseUrl, model: apiModel, thinkingDepth }, lang, s.id, s.messages, s.summaries, s.stage, s.name);
  };
  
  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSessions = savedSessions.filter(s => s.id !== id);
    setSavedSessions(newSessions);
    localStorage.setItem('saved_sessions', JSON.stringify(newSessions));
  };


  useEffect(() => {
    const saved = localStorage.getItem('customPhilosophers');
    if (saved) {
      try {
        setCustomPhilosophers(JSON.parse(saved));
      } catch (e) {}
    }
    const savedOverrides = localStorage.getItem('philosopherOverrides');
    if (savedOverrides) {
      try {
        setOverrides(JSON.parse(savedOverrides));
      } catch (e) {}
    }
  }, []);

  const saveCustomPhilosophers = (philosophers: Philosopher[]) => {
    setCustomPhilosophers(philosophers);
    localStorage.setItem('customPhilosophers', JSON.stringify(philosophers));
  };

  const saveOverrides = (newOverrides: Record<string, Partial<Philosopher>>) => {
    setOverrides(newOverrides);
    localStorage.setItem('philosopherOverrides', JSON.stringify(newOverrides));
  };

  const allPhilosophers = [
    ...PRESET_PHILOSOPHERS.map(p => {
      const o = overrides[p.id];
      if (o) {
        return { ...p, ...o };
      }
      return p;
    }),
    ...customPhilosophers.map(p => {
      const o = overrides[p.id];
      if (o) {
        return { ...p, ...o };
      }
      return p;
    })
  ];

  const openModal = (id?: string) => {
    if (id) {
      const p = allPhilosophers.find(x => x.id === id);
      if (p) {
        setCpName(p.name);
        setCpNameEn(p.nameEn);
        setCpDesc(p.description);
        setCpDescEn(p.descriptionEn);
        setCpPrompt(p.customPrompt || '');
        setCpFileContent(p.fileContent || '');
        setCpFileName(p.fileContent ? 'File attached' : '');
        setEditingId(id);
      }
    } else {
      setCpName('');
      setCpNameEn('');
      setCpDesc('');
      setCpDescEn('');
      setCpPrompt('');
      setCpFileContent('');
      setCpFileName('');
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const [isGeneratingToc, setIsGeneratingToc] = useState(false);

  const generateToc = async () => {
    if (!cpFileContent) return;
    setIsGeneratingToc(true);
    try {
      const response = await fetch('/api/toc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-config': JSON.stringify(initialApiConfig)
        },
        body: JSON.stringify({
          text: cpFileContent,
          language: lang
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.toc) {
          setCpFileContent(`---\n# AI Generated Table of Contents\n${data.toc}\n---\n\n${cpFileContent}`);
        }
      } else {
        alert("Failed to generate TOC");
      }
    } catch (e) {
      console.error(e);
      alert("Error generating TOC");
    } finally {
      setIsGeneratingToc(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCpFileName(file.name);
      if (file.name.toLowerCase().endsWith('.pdf')) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
          let text = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map((item: any) => item.str).join(' ');
            text += pageText + '\n';
          }
          setCpFileContent(text);
        } catch (error) {
          console.error("Error parsing PDF:", error);
          alert("Failed to parse PDF file.");
          setCpFileName('');
        }
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          setCpFileContent(e.target?.result as string);
        };
        reader.readAsText(file);
      }
    }
  };

  const saveCustomPhilosopher = () => {
    if (!cpName || !cpNameEn) {
      alert(lang === 'zh' ? '请输入姓名' : 'Please enter names');
      return;
    }
    const newP: Philosopher = {
      id: editingId || `custom_${Date.now()}`,
      name: cpName,
      nameEn: cpNameEn,
      description: cpDesc,
      descriptionEn: cpDescEn,
      color: '#0ea5e9', // default sky-500
      isCustom: true,
      customPrompt: cpPrompt,
      fileContent: cpFileContent
    };

    if (editingId) {
      saveCustomPhilosophers(customPhilosophers.map(p => p.id === editingId ? newP : p));
    } else {
      saveCustomPhilosophers([...customPhilosophers, newP]);
    }
    setIsModalOpen(false);
  };

  const openAdvancedModal = () => {
    const configObj: Record<string, any> = {};
    allPhilosophers.forEach(p => {
      if (selectedIds.has(p.id)) {
        configObj[p.id] = {
          name: p.name,
          nameEn: p.nameEn,
          description: p.description,
          descriptionEn: p.descriptionEn,
          customPrompt: p.customPrompt || "",
          color: p.color
        };
      }
    });
    setJsonText(JSON.stringify(configObj, null, 2));
    setIsAdvancedOpen(true);
  };

  const saveAdvancedConfig = () => {
    try {
      const parsed = JSON.parse(jsonText);
      const newOverrides = { ...overrides };
      const newCustomPhilosophers = [...customPhilosophers];

      Object.keys(parsed).forEach(id => {
        const item = parsed[id];
        const updateData: Partial<Philosopher> = {
          name: item.name,
          nameEn: item.nameEn,
          description: item.description,
          descriptionEn: item.descriptionEn,
          customPrompt: item.customPrompt,
          color: item.color
        };

        newOverrides[id] = updateData;

        // If it is a custom philosopher, also update customPhilosophers list
        const customIdx = newCustomPhilosophers.findIndex(cp => cp.id === id);
        if (customIdx !== -1) {
          newCustomPhilosophers[customIdx] = {
            ...newCustomPhilosophers[customIdx],
            ...updateData
          };
        }
      });

      saveOverrides(newOverrides);
      saveCustomPhilosophers(newCustomPhilosophers);
      setIsAdvancedOpen(false);
    } catch (e: any) {
      alert(lang === 'zh' ? `保存失败：JSON 语法错误 (${e.message})` : `Failed to save: JSON Syntax Error (${e.message})`);
    }
  };

  const t = {
    zh: {
      title: "哲学人的圆桌",
      desc: "邀请历史上的伟大思想家，就你关心的话题展开一场跨越时空的辩论。",
      topicLabel: "辩论话题 (哲学命题)",
      topicPlaceholder: "例如：自由意志是否存在？",
      inviteLabel: "邀请哲学家 (2~6位)",
      maxError: "最多只能邀请6位哲学家",
      minError: "请至少邀请2位哲学家",
      topicError: "请输入一个哲学命题",
      apiConfig: "API 配置 (可选)",
      apiDescGemini: "默认使用系统提供的Key。如果您想使用自己的模型配额，请在此输入。",
      apiDescOpenai: "配置 OpenAI 兼容的 API (如 DeepSeek, Kimi, 或 OpenAI)。",
      startBtn: "开启圆桌会议",
      langSelect: "语言",
    },
    en: {
      title: "Philosopher's Roundtable",
      desc: "Invite history's greatest thinkers for a debate across time on a topic you care about.",
      topicLabel: "Debate Topic",
      topicPlaceholder: "e.g., Does free will exist?",
      inviteLabel: "Invite Philosophers (2~6)",
      maxError: "You can invite a maximum of 6 philosophers.",
      minError: "Please invite at least 2 philosophers.",
      topicError: "Please enter a topic.",
      apiConfig: "API Configuration (Optional)",
      apiDescGemini: "Uses system key by default. Enter your own API key to use your quota.",
      apiDescOpenai: "Configure an OpenAI compatible API (e.g. OpenAI, DeepSeek, etc).",
      startBtn: "Start Roundtable",
      langSelect: "Language",
    }
  };

  const currentT = t[lang];

  const togglePhilosopher = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      if (newSet.size >= 6) {
        setError(currentT.maxError);
        return;
      }
      newSet.add(id);
    }
    setError('');
    setSelectedIds(newSet);
  };


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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      setError(currentT.topicError);
      return;
    }
    if (selectedIds.size < 2) {
      setError(currentT.minError);
      return;
    }
    
    // Auto-correct provider if they pasted an OpenAI key but forgot to change the dropdown
    let finalProvider = apiProvider;
    if (apiProvider === 'gemini' && apiKey.trim().startsWith('sk-')) {
      finalProvider = 'openai';
    }

    const selected = allPhilosophers.filter(p => selectedIds.has(p.id));
    onStart(topic.trim(), selected, {
      provider: finalProvider,
      key: apiKey.trim(),
      baseUrl: apiBaseUrl.trim(),
      model: apiModel.trim() || 'gpt-4o'
    }, lang);
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 relative">
      
      {/* Top Controls */}
      <div className="flex justify-end mb-8">
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm border border-neutral-200">
          <Globe className="w-4 h-4 text-neutral-500" />
          <select 
            value={lang} 
            onChange={e => setLang(e.target.value as Language)}
            className="text-sm bg-transparent outline-none text-neutral-700 font-medium"
          >
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl font-serif font-bold text-neutral-900 tracking-tight flex items-center justify-center gap-3">
          <MessageSquareQuote className="w-10 h-10 text-neutral-700" />
          {currentT.title}
        </h1>
        <p className="mt-4 text-lg text-neutral-600">{currentT.desc}</p>
      </motion.div>


      {savedSessions.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-4">
            {lang === 'zh' ? '继续之前的会话' : 'Continue Previous Session'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedSessions.map(s => (
              <div 
                key={s.id} 
                onClick={() => restoreSession(s)}
                className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 hover:border-neutral-800 hover:shadow-md cursor-pointer transition-all flex flex-col relative group"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium text-neutral-900 truncate pr-6">{s.name}</h3>
                  <button 
                    onClick={(e) => deleteSession(s.id, e)}
                    className="absolute right-3 top-3 text-neutral-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-neutral-500 mb-3 truncate">{s.topic}</p>
                <div className="flex items-center gap-2 mt-auto">
                  <div className="flex -space-x-2">
                    {s.philosophers.slice(0, 4).map(p => (
                      <div 
                        key={p.id} 
                        className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                        style={{ backgroundColor: p.color }}
                        title={lang === 'zh' ? p.name : p.nameEn}
                      >
                        {(lang === 'zh' ? p.name : p.nameEn).charAt(0)}
                      </div>
                    ))}
                    {s.philosophers.length > 4 && (
                      <div className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-neutral-600 bg-neutral-100 shadow-sm">
                        +{s.philosophers.length - 4}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-neutral-400 ml-auto">{new Date(s.date).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
      
      <div className="flex items-center mb-6">
        <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider">
          {lang === 'zh' ? '新建会话' : 'New Session'}
        </h2>
        <div className="h-px bg-neutral-200 flex-1 ml-4" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          
          {/* Topic */}
          <div>
            <label className="block text-sm font-medium text-neutral-900 mb-2">
              {currentT.topicLabel}
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={currentT.topicPlaceholder}
              className="w-full px-4 py-3 rounded-xl border border-neutral-300 focus:ring-2 focus:ring-neutral-800 focus:border-neutral-800 outline-none transition-all text-lg"
            />
          </div>

          {/* Philosophers Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-neutral-900 flex items-center gap-2">
                <Users className="w-4 h-4" />
                {currentT.inviteLabel}
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={openAdvancedModal}
                  className="text-xs font-medium text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 px-2.5 py-1 rounded transition-colors"
                >
                  {lang === 'zh' ? '高级选项 (编辑系统提示词)' : 'Advanced Options (Edit Prompts)'}
                </button>
                <span className="text-sm text-neutral-500">{selectedIds.size}/6</span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {allPhilosophers.map((p) => (
                <div
                  key={p.id}
                  onClick={() => togglePhilosopher(p.id)}
                  className={`cursor-pointer p-4 rounded-xl border-2 transition-all group relative ${
                    selectedIds.has(p.id) 
                      ? 'border-neutral-900 bg-neutral-900 text-white shadow-md' 
                      : 'border-neutral-200 bg-white text-neutral-800 hover:border-neutral-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="font-semibold text-lg">{lang === 'zh' ? p.name : p.nameEn}</div>
                    {p.isCustom && (
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openModal(p.id); }}
                        className={`p-1 transition-colors ${selectedIds.has(p.id) ? 'text-neutral-300 hover:text-white' : 'text-neutral-600 hover:text-neutral-900'}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className={`text-xs mt-1 line-clamp-2 ${selectedIds.has(p.id) ? 'text-neutral-300' : 'text-neutral-500'}`}>
                    {lang === 'zh' ? p.description : p.descriptionEn}
                  </div>
                </div>
              ))}
              <div
                onClick={() => openModal()}
                className="cursor-pointer p-4 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 text-neutral-500 hover:border-neutral-400 hover:bg-neutral-100 flex flex-col items-center justify-center transition-all min-h-[96px]"
              >
                <Plus className="w-6 h-6 mb-1" />
                <span className="text-sm font-medium">{lang === 'zh' ? '添加哲学家' : 'Add Philosopher'}</span>
              </div>
            </div>
          </div>

          {/* API Key */}
          <div className="pt-6 border-t border-neutral-100">
            
            <div className="flex flex-col mb-4 gap-2">
              <label className="text-sm font-medium text-neutral-900 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                {currentT.apiConfig}
              </label>
              <div className="flex flex-wrap bg-neutral-100 p-1 rounded-lg gap-1">
                {(['gemini', 'anthropic', 'openai', 'deepseek', 'custom'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setApiProvider(p)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex-1 ${apiProvider === p ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            
            
            <p className="text-xs text-neutral-500 mb-3">
              {apiProvider === 'gemini' && (lang === 'zh' ? '使用 Google Gemini API。' : 'Uses Google Gemini API.')}
              {apiProvider === 'anthropic' && (lang === 'zh' ? '使用 Anthropic Claude API。' : 'Uses Anthropic Claude API.')}
              {apiProvider === 'deepseek' && (lang === 'zh' ? '使用 DeepSeek API。' : 'Uses DeepSeek API.')}
              {apiProvider === 'openai' && (lang === 'zh' ? '使用 OpenAI API。' : 'Uses OpenAI API.')}
              {apiProvider === 'custom' && (lang === 'zh' ? '使用自定义的 OpenAI 兼容接口。' : 'Uses a custom OpenAI-compatible API.')}
            </p>
            
            <div className="space-y-3">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={apiProvider === 'gemini' ? 'AIzaSy...' : 'sk-...'}
                className="w-full px-4 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-neutral-800 focus:border-neutral-800 outline-none font-mono text-sm"
              />
              {(apiProvider === 'openai' || apiProvider === 'custom' || apiProvider === 'anthropic' || apiProvider === 'deepseek') && (
                <input
                  type="text"
                  value={apiModel}
                  onChange={(e) => setApiModel(e.target.value)}
                  placeholder={`Model Name (e.g. ${apiProvider === 'openai' ? 'gpt-4o' : apiProvider === 'anthropic' ? 'claude-3-5-sonnet-20241022' : apiProvider === 'deepseek' ? 'deepseek-reasoner' : 'model-name'})`}
                  className="w-full px-4 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-neutral-800 focus:border-neutral-800 outline-none font-mono text-sm"
                />
              )}
              {apiProvider === 'custom' && (
                <input
                  type="text"
                  value={apiBaseUrl}
                  onChange={(e) => setApiBaseUrl(e.target.value)}
                  placeholder="Base URL (e.g. https://api.example.com/v1)"
                  className="w-full px-4 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-neutral-800 focus:border-neutral-800 outline-none font-mono text-sm"
                />
              )}
              
              <div className="pt-2">
                <label className="text-sm font-medium text-neutral-700 block mb-2">
                  {lang === 'zh' ? '思考深度 (Thinking Depth)' : 'Thinking Depth'}
                </label>
                <select 
                  value={thinkingDepth || ''} 
                  onChange={(e) => setThinkingDepth(e.target.value ? (e.target.value as any) : undefined)}
                  className="w-full px-4 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-neutral-800 outline-none text-sm bg-white"
                >
                  <option value="">{lang === 'zh' ? '默认 (Default)' : 'Default'}</option>
                  <option value="low">{lang === 'zh' ? '较低 (Low)' : 'Low'}</option>
                  <option value="medium">{lang === 'zh' ? '中等 (Medium)' : 'Medium'}</option>
                  <option value="high">{lang === 'zh' ? '较高 (High)' : 'High'}</option>
                  <option value="extra-high">{lang === 'zh' ? '极高 (Extra High)' : 'Extra High'}</option>
                </select>
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
                  <span className={`text-xs font-medium ${testStatus === 'success' ? 'text-green-600' : testStatus === 'error' ? 'text-red-600' : 'text-neutral-500'}`}>
                    {testMessage}
                  </span>
                )}
              </div>

            </div>

          </div>

          {error && (
            <div className="p-4 rounded-lg bg-red-50 text-red-600 text-sm font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-4 px-6 rounded-xl bg-neutral-900 text-white font-medium text-lg hover:bg-neutral-800 active:scale-[0.98] transition-all"
          >
            {currentT.startBtn}
          </button>
        </form>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="flex justify-between items-center p-4 border-b border-neutral-100">
                <h3 className="text-lg font-semibold text-neutral-900">
                  {lang === 'zh' ? (editingId ? '编辑哲学家' : '添加哲学家') : (editingId ? 'Edit Philosopher' : 'Add Philosopher')}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-neutral-400 hover:text-neutral-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Name (Chinese)</label>
                    <input 
                      value={cpName} 
                      onChange={e => setCpName(e.target.value)} 
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm outline-none focus:border-neutral-800" 
                      placeholder="e.g. 奥古斯丁"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Name (English)</label>
                    <input 
                      value={cpNameEn} 
                      onChange={e => setCpNameEn(e.target.value)} 
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm outline-none focus:border-neutral-800" 
                      placeholder="e.g. Augustine"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Description (Chinese)</label>
                    <input 
                      value={cpDesc} 
                      onChange={e => setCpDesc(e.target.value)} 
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm outline-none focus:border-neutral-800" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Description (English)</label>
                    <input 
                      value={cpDescEn} 
                      onChange={e => setCpDescEn(e.target.value)} 
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm outline-none focus:border-neutral-800" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    {lang === 'zh' ? '自定义初始提示词 / 角色设定' : 'Custom Prompt / Role Instructions'}
                  </label>
                  <textarea 
                    value={cpPrompt} 
                    onChange={e => setCpPrompt(e.target.value)} 
                    rows={4}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm outline-none focus:border-neutral-800 resize-none" 
                    placeholder={lang === 'zh' ? "描述这个哲学家的核心思想、说话风格等..." : "Describe core ideas and speaking style..."}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    {lang === 'zh' ? '上传参考资料 (仅支持 TXT/Markdown)' : 'Upload Reference Material (TXT/Markdown)'}
                  </label>
                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-2 bg-neutral-100 text-neutral-700 text-sm rounded-lg hover:bg-neutral-200"
                    >
                      <Upload className="w-4 h-4" /> 
                      {lang === 'zh' ? '选择文件' : 'Select File'}
                    </button>
                    <span className="text-xs text-neutral-500 truncate max-w-[200px]">
                      {cpFileName || (lang === 'zh' ? '未选择文件' : 'No file selected')}
                    </span>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    accept=".txt,.md,.pdf" 
                    className="hidden" 
                  />
                  {cpFileContent && (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center justify-between text-xs text-green-600 bg-green-50 p-2 rounded border border-green-100">
                        <span>{lang === 'zh' ? '文件读取成功，大小:' : 'File loaded, size:'} {(cpFileContent.length / 1024).toFixed(1)}KB</span>
                        <button
                          onClick={() => { setCpFileContent(''); setCpFileName(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                          className="text-red-500 hover:text-red-700 transition-colors"
                          title={lang === 'zh' ? '删除文件' : 'Delete file'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <textarea
                        value={cpFileContent}
                        onChange={(e) => setCpFileContent(e.target.value)}
                        className="w-full h-32 px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-y"
                        placeholder={lang === 'zh' ? '在此处查看或编辑文件内容...' : 'View or edit file content here...'}
                      />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={generateToc}
                          disabled={isGeneratingToc}
                          className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          {isGeneratingToc ? (lang === 'zh' ? '生成中...' : 'Generating...') : (lang === 'zh' ? 'AI 智能生成目录' : 'AI Generate TOC')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-neutral-100 bg-neutral-50 flex justify-end gap-2">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 rounded-lg"
                >
                  {lang === 'zh' ? '取消' : 'Cancel'}
                </button>
                <button 
                  onClick={saveCustomPhilosopher}
                  className="px-4 py-2 text-sm font-medium bg-neutral-900 text-white hover:bg-neutral-800 rounded-lg"
                >
                  {lang === 'zh' ? '保存' : 'Save'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isAdvancedOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="flex justify-between items-center p-4 border-b border-neutral-100">
                <h3 className="text-lg font-semibold text-neutral-900 font-serif">
                  {lang === 'zh' ? '高级选项：编辑所选哲学家配置 (JSON)' : 'Advanced Options: Edit Selected (JSON)'}
                </h3>
                <button onClick={() => setIsAdvancedOpen(false)} className="text-neutral-400 hover:text-neutral-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 flex flex-col space-y-3">
                <p className="text-xs text-neutral-500 leading-relaxed">
                  {lang === 'zh' 
                    ? '以下为当前选中的哲学家的初始配置（提示词、姓名和简介）。您可在此直接进行 JSON 编辑，保存后即时应用。'
                    : 'Below is the configuration of currently selected philosophers. You can edit names, descriptions, or custom prompts directly in JSON format.'}
                </p>

                <textarea
                  value={jsonText}
                  onChange={e => setJsonText(e.target.value)}
                  className="w-full flex-1 min-h-[350px] p-4 bg-neutral-900 text-green-400 rounded-xl font-mono text-xs leading-normal outline-none focus:ring-2 focus:ring-neutral-800 resize-none"
                  spellCheck={false}
                />
              </div>

              <div className="p-4 border-t border-neutral-100 bg-neutral-50 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdvancedOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 rounded-lg"
                >
                  {lang === 'zh' ? '取消' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={saveAdvancedConfig}
                  className="px-4 py-2 text-sm font-medium bg-neutral-900 text-white hover:bg-neutral-800 rounded-lg"
                >
                  {lang === 'zh' ? '保存' : 'Save'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
