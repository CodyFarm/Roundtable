import { useState, useEffect, useRef } from 'react';
import { Philosopher, PRESET_PHILOSOPHERS, ApiConfig, ApiProvider, Language, SavedSession, Message, Summary, Stage, UserInfo, SharedPhilosopherEntry, SharedSessionEntry, SessionMode } from '../types';
import { Settings, Users, MessageSquareQuote, Globe, Plus, Edit2, X, Upload, Trash2, BookOpen, User, LogOut, Cloud, Share2, Download, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as pdfjsLib from 'pdfjs-dist';

// Use a public CDN for the worker to avoid Vite configuration issues
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface Props {
  onStart: (topic: string, philosophers: Philosopher[], apiConfig: ApiConfig, language: Language, mode: SessionMode, restoreSessionId?: string, restoreMessages?: Message[], restoreSummaries?: Summary[], restoreStage?: Stage, restoreName?: string, restoreMode?: SessionMode) => void;
  initialApiConfig: ApiConfig;
  initialLanguage: Language;
  user: UserInfo | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  initialMode: SessionMode;
}

export default function SetupScreen({ onStart, initialApiConfig, initialLanguage, user, onOpenAuth, onLogout, initialMode }: Props) {
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState<SessionMode>(initialMode);
  
  const [apiProvider, setApiProvider] = useState<ApiProvider>(initialApiConfig.provider || 'deepseek');
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
  const [sharedPhilosophers, setSharedPhilosophers] = useState<SharedPhilosopherEntry[]>([]);
  const [cloudSessions, setCloudSessions] = useState<SharedSessionEntry[]>([]);
  const [shareToPool, setShareToPool] = useState(false);
  const [loadingShared, setLoadingShared] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem('saved_sessions');
    if (saved) {
      try {
        setSavedSessions(JSON.parse(saved));
      } catch(e) {}
    }
  }, []);

  // Fetch shared philosophers (no auth required)
  useEffect(() => {
    const fetchShared = async () => {
      setLoadingShared(true);
      try {
        const res = await fetch('/api/philosophers/shared');
        if (res.ok) {
          const data = await res.json();
          setSharedPhilosophers(data);
        }
      } catch (e) {
        console.error('Failed to fetch shared philosophers:', e);
      } finally {
        setLoadingShared(false);
      }
    };
    fetchShared();
  }, []);

  // Fetch cloud sessions (only when logged in)
  useEffect(() => {
    if (!user) {
      setCloudSessions([]);
      return;
    }
    const fetchCloudSessions = async () => {
      try {
        const res = await fetch('/api/sessions/shared', {
          headers: { 'Authorization': `Bearer ${user.token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setCloudSessions(data);
        }
      } catch (e) {
        console.error('Failed to fetch cloud sessions:', e);
      }
    };
    fetchCloudSessions();
  }, [user]);
  
  const restoreSession = (s: SavedSession) => {
    onStart(s.topic, s.philosophers, { provider: apiProvider, key: apiKey, baseUrl: apiBaseUrl, model: apiModel, thinkingDepth }, lang, s.mode || 'debate', s.id, s.messages, s.summaries, s.stage, s.name, s.mode || 'debate');
  };

  const restoreCloudSession = (entry: SharedSessionEntry) => {
    const s = entry.session;
    onStart(s.topic, s.philosophers, { provider: apiProvider, key: apiKey, baseUrl: apiBaseUrl, model: apiModel, thinkingDepth }, lang, s.mode || 'debate', s.id, s.messages, s.summaries, s.stage, s.name, s.mode || 'debate');
  };
  
  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSessions = savedSessions.filter(s => s.id !== id);
    setSavedSessions(newSessions);
    localStorage.setItem('saved_sessions', JSON.stringify(newSessions));
  };

  const deleteCloudSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    try {
      const res = await fetch(`/api/sessions/shared/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      if (res.ok) {
        setCloudSessions(prev => prev.filter(s => s.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete cloud session:', err);
    }
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
    }),
    ...sharedPhilosophers
      .filter(sp => {
        // Deduplicate: skip shared philosophers that match an existing custom philosopher (by name)
        const alreadyExists = customPhilosophers.some(
          cp => cp.name === sp.philosopher.name && cp.nameEn === sp.philosopher.nameEn
        );
        return !alreadyExists;
      })
      .map(sp => {
        const o = overrides[sp.id];
        const p = { ...sp.philosopher, isCustom: true, isShared: true, sharedBy: sp.username };
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
        // Prevent editing shared philosophers from other users
        if (p.isShared && p.sharedBy !== user?.username) {
          return;
        }
        // Prevent editing philosophers owned by another user
        if (p.createdBy && p.createdBy !== user?.username) {
          return;
        }
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

  const saveCustomPhilosopher = async () => {
    if (!cpName || !cpNameEn) {
      alert(lang === 'zh' ? '请输入姓名' : 'Please enter names');
      return;
    }
    // Preserve original createdBy when editing; set it when creating while logged in
    const existingPhilosopher = editingId
      ? customPhilosophers.find(p => p.id === editingId)
      : null;
    const newP: Philosopher = {
      id: editingId || `custom_${Date.now()}`,
      name: cpName,
      nameEn: cpNameEn,
      description: cpDesc,
      descriptionEn: cpDescEn,
      color: '#0ea5e9', // default sky-500
      isCustom: true,
      createdBy: existingPhilosopher?.createdBy || (user ? user.username : undefined),
      customPrompt: cpPrompt,
      fileContent: cpFileContent
    };

    if (editingId) {
      saveCustomPhilosophers(customPhilosophers.map(p => p.id === editingId ? newP : p));
    } else {
      saveCustomPhilosophers([...customPhilosophers, newP]);
    }

    // Share to pool if checked and user is logged in
    if (shareToPool && user) {
      try {
        const res = await fetch('/api/philosophers/share', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.token}`
          },
          body: JSON.stringify({ philosopher: newP })
        });
        if (res.ok) {
          const entry = await res.json();
          setSharedPhilosophers(prev => [...prev, entry]);
        } else {
          const err = await res.json().catch(() => ({}));
          alert(err.error || (lang === 'zh' ? '上传到共享池失败' : 'Failed to share to pool'));
        }
      } catch (e) {
        console.error('Failed to share philosopher:', e);
      }
    }

    setShareToPool(false);
    setIsModalOpen(false);
  };

  const openAdvancedModal = () => {
    const configObj: Record<string, any> = {};
    allPhilosophers.forEach(p => {
      if (selectedIds.has(p.id)) {
        // Skip shared philosophers from other users (can't edit them)
        if (p.isShared && p.sharedBy !== user?.username) {
          return;
        }
        // Skip philosophers owned by another user
        if (p.createdBy && p.createdBy !== user?.username) {
          return;
        }
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
      // Chat mode
      chatTitle: "与思想家对话",
      chatDesc: "选择一位你仰慕的哲学家，进行一对一的深度对话。话题可选。",
      chatTopicLabel: "话题 (可选)",
      chatTopicPlaceholder: "可选：输入你想聊的话题，留空则由哲学家自由开场...",
      chatInviteLabel: "选择哲学家 (1位)",
      chatStartBtn: "开始对话",
      modeLabel: "模式选择",
      debateMode: "辩论模式",
      chatMode: "对话模式",
      chatMinError: "请选择一位哲学家",
    },
    en: {
      title: "Phils Roundtable",
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
      // Chat mode
      chatTitle: "Dialogue with a Thinker",
      chatDesc: "Choose a philosopher you admire and have a deep one-on-one conversation. Topic optional.",
      chatTopicLabel: "Topic (Optional)",
      chatTopicPlaceholder: "Optional: Enter a topic to discuss, or leave blank for the philosopher to start...",
      chatInviteLabel: "Select a Philosopher (1)",
      chatStartBtn: "Start Dialogue",
      modeLabel: "Mode",
      debateMode: "Debate",
      chatMode: "Dialogue",
      chatMinError: "Please select one philosopher",
    }
  };

  const currentT = t[lang];

  const togglePhilosopher = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      const maxCount = mode === 'chat' ? 1 : 6;
      if (newSet.size >= maxCount) {
        if (mode === 'chat') {
          // In chat mode, replace the selection (only 1 philosopher allowed)
          newSet.clear();
        } else {
          setError(currentT.maxError);
          return;
        }
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
    // Topic is required only in debate mode
    if (mode === 'debate' && !topic.trim()) {
      setError(currentT.topicError);
      return;
    }
    if (selectedIds.size < (mode === 'chat' ? 1 : 2)) {
      setError(mode === 'chat' ? (lang === 'zh' ? '请选择一位哲学家' : 'Please select one philosopher') : currentT.minError);
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
      baseUrl: apiBaseUrl.trim() || undefined,
      model: apiModel.trim() || undefined
    }, lang, mode);
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      const res = await fetch('/api/auth/account', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      if (res.ok) {
        onLogout();
        setIsDeleteModalOpen(false);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || (lang === 'zh' ? '注销失败，请重试' : 'Failed to delete account'));
      }
    } catch (e) {
      alert(lang === 'zh' ? '网络错误，注销失败' : 'Network error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter out local sessions that are already synced to cloud
  const localOnlySessions = savedSessions.filter(ls =>
    !cloudSessions.some(cs =>
      cs.session.name === ls.name && cs.session.topic === ls.topic
    )
  );

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 relative">
      
      {/* Top Controls */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm border border-neutral-200">
                <User className="w-4 h-4 text-indigo-500" />
                <span className="text-sm text-neutral-700 font-medium">{user.username}</span>
              </div>
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-red-500 transition-colors bg-white px-2.5 py-1.5 rounded-full shadow-sm border border-neutral-200"
              >
                <LogOut className="w-3.5 h-3.5" />
                {lang === 'zh' ? '退出' : 'Logout'}
              </button>
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-red-600 transition-colors bg-white px-2.5 py-1.5 rounded-full shadow-sm border border-neutral-200"
                title={lang === 'zh' ? '注销账户' : 'Delete Account'}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {lang === 'zh' ? '注销' : 'Del'}
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full shadow-sm border border-neutral-200 text-sm text-neutral-700 hover:text-neutral-900 hover:border-neutral-300 transition-colors font-medium"
            >
              <User className="w-4 h-4" />
              {lang === 'zh' ? '登录 / 注册' : 'Login / Register'}
            </button>
          )}
        </div>
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
          {mode === 'chat' ? (
            <MessageCircle className="w-10 h-10 text-neutral-700" />
          ) : (
            <MessageSquareQuote className="w-10 h-10 text-neutral-700" />
          )}
          {mode === 'chat' ? currentT.chatTitle : currentT.title}
        </h1>
        <p className="mt-4 text-lg text-neutral-600">
          {mode === 'chat' ? currentT.chatDesc : currentT.desc}
        </p>
      </motion.div>


      {localOnlySessions.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-4">
            {lang === 'zh' ? '继续之前的会话' : 'Continue Previous Session'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {localOnlySessions.map(s => (
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

      {/* Cloud Sessions - only when logged in */}
      {user && cloudSessions.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
          <h2 className="text-sm font-semibold text-indigo-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Cloud className="w-4 h-4" />
            {lang === 'zh' ? '云端会话' : 'Cloud Sessions'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cloudSessions.map(entry => (
              <div
                key={entry.id}
                onClick={() => restoreCloudSession(entry)}
                className="bg-white p-4 rounded-xl shadow-sm border border-indigo-200 hover:border-indigo-400 hover:shadow-md cursor-pointer transition-all flex flex-col relative group"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium text-neutral-900 truncate pr-6">{entry.session.name}</h3>
                  <button
                    onClick={(e) => deleteCloudSession(entry.id, e)}
                    className="absolute right-3 top-3 text-neutral-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-neutral-500 mb-3 truncate">{entry.session.topic}</p>
                <div className="flex items-center gap-2 mt-auto">
                  <div className="flex -space-x-2">
                    {entry.session.philosophers.slice(0, 4).map(p => (
                      <div
                        key={p.id}
                        className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                        style={{ backgroundColor: p.color }}
                        title={lang === 'zh' ? p.name : p.nameEn}
                      >
                        {(lang === 'zh' ? p.name : p.nameEn).charAt(0)}
                      </div>
                    ))}
                    {entry.session.philosophers.length > 4 && (
                      <div className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-neutral-600 bg-neutral-100 shadow-sm">
                        +{entry.session.philosophers.length - 4}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-neutral-400 ml-auto">{new Date(entry.createdAt).toLocaleDateString()}</span>
                  <span className="text-[10px] text-indigo-400 flex items-center gap-0.5"><Cloud className="w-3 h-3" /></span>
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
        {/* Mode Toggle */}
        <div className="flex items-center gap-2 ml-4 bg-white rounded-full border border-neutral-200 p-1 shadow-sm">
          <span className="text-sm font-semibold text-neutral-800 ml-2 mr-0.5 tracking-wide">{currentT.modeLabel}</span>
          <button
            type="button"
            onClick={() => { setMode('debate'); setSelectedIds(new Set(selectedIds)); setError(''); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${mode === 'debate' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
          >
            {currentT.debateMode}
          </button>
          <button
            type="button"
            onClick={() => { setMode('chat'); if (selectedIds.size > 1) { setSelectedIds(new Set([...selectedIds][0] ? [[...selectedIds][0]] : [])); } setError(''); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${mode === 'chat' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
          >
            {currentT.chatMode}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          
          {/* Topic */}
          <div>
            <label className="block text-sm font-medium text-neutral-900 mb-2">
              {mode === 'chat' ? currentT.chatTopicLabel : currentT.topicLabel}
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={mode === 'chat' ? currentT.chatTopicPlaceholder : currentT.topicPlaceholder}
              className="w-full px-4 py-3 rounded-xl border border-neutral-300 focus:ring-2 focus:ring-neutral-800 focus:border-neutral-800 outline-none transition-all text-lg"
            />
            {mode === 'chat' && (
              <p className="text-xs text-neutral-400 mt-1">
                {lang === 'zh' ? '💡 留空即可与哲学家自由对话，AI 将代为开场' : '💡 Leave blank for a free-form conversation — the philosopher will start.'}
              </p>
            )}
          </div>

          {/* Philosophers Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-neutral-900 flex items-center gap-2">
                <Users className="w-4 h-4" />
                {mode === 'chat' ? currentT.chatInviteLabel : currentT.inviteLabel}
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={openAdvancedModal}
                  className="text-xs font-medium text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 px-2.5 py-1 rounded transition-colors"
                >
                  {lang === 'zh' ? '高级选项 (编辑系统提示词)' : 'Advanced Options (Edit Prompts)'}
                </button>
                <span className="text-sm text-neutral-500">{selectedIds.size}/{mode === 'chat' ? 1 : 6}</span>
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
                    <div className="flex items-center gap-1">
                      {p.isShared && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${selectedIds.has(p.id) ? 'bg-indigo-500 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
                          <Share2 className="w-2.5 h-2.5 inline mr-0.5" />
                          {p.sharedBy || 'shared'}
                        </span>
                      )}
                      {p.isCustom && !p.isShared && (!p.createdBy || p.createdBy === user?.username) && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openModal(p.id); }}
                          className={`p-1 transition-colors ${selectedIds.has(p.id) ? 'text-neutral-300 hover:text-white' : 'text-neutral-600 hover:text-neutral-900'}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
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
                  disabled={testStatus === 'testing'}
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
            className="w-full py-4 px-6 rounded-xl bg-neutral-900 text-white font-medium text-lg hover:bg-neutral-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {mode === 'chat' ? (
              <><MessageCircle className="w-5 h-5" />{currentT.chatStartBtn}</>
            ) : (
              <><MessageSquareQuote className="w-5 h-5" />{currentT.startBtn}</>
            )}
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
                    {lang === 'zh' ? '上传参考资料 (TXT/Markdown/PDF)' : 'Upload Reference Material (TXT/Markdown/PDF)'}
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

                {/* Share to pool checkbox - only visible for logged-in users */}
                {user && (
                  <label className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-lg cursor-pointer hover:bg-indigo-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={shareToPool}
                      onChange={(e) => setShareToPool(e.target.checked)}
                      className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-medium text-indigo-800">
                      <Share2 className="w-3.5 h-3.5 inline mr-1" />
                      {lang === 'zh' ? '上传到哲学家共享池（所有用户可见）' : 'Share to philosopher pool (visible to all users)'}
                    </span>
                  </label>
                )}
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

        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <Trash2 className="w-5 h-5 text-red-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-neutral-900">
                    {lang === 'zh' ? '确认注销账户' : 'Confirm Account Deletion'}
                  </h3>
                </div>
                <p className="text-sm text-neutral-600 mb-2">
                  {lang === 'zh'
                    ? '此操作将永久删除你的账户、所有数据以及云端共享内容。该操作不可撤销。'
                    : 'This will permanently delete your account, all data, and cloud shares. This action cannot be undone.'}
                </p>
                <p className="text-xs text-neutral-400 mb-6">
                  {lang === 'zh'
                    ? '你使用的邀请码将被释放，可供他人重新使用。'
                    : 'Your invitation code will be released for others to use.'}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsDeleteModalOpen(false)}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {lang === 'zh' ? '取消' : 'Cancel'}
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isDeleting ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    {isDeleting
                      ? (lang === 'zh' ? '注销中...' : 'Deleting...')
                      : (lang === 'zh' ? '确认注销' : 'Delete Account')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
