import { useState, useRef, useEffect } from 'react';
import { Stage, Philosopher, Message, Role, Relation, ApiConfig, Language, Summary, UserInfo, SessionMode } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Play, Target, BookOpen, User, Crown, Lightbulb, MessageCircleQuestion, Hand, X, Save, Check, Cloud, Upload, MessageCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";



function CollapsibleSection({ children, defaultExpanded = false, maxLines = 5 }: { children: React.ReactNode, defaultExpanded?: boolean, maxLines?: number }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  
  return (
    <div className="relative">
      <div className={expanded ? "" : "overflow-hidden max-h-48 relative"}>
        {children}
        {!expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent pointer-events-none" />
        )}
      </div>
      <div className="mt-2 text-center">
        <button 
          onClick={() => setExpanded(!expanded)} 
          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium bg-indigo-50 px-3 py-1 rounded-full transition-colors"
        >
          {expanded ? "收起 (Collapse)" : "展开 (Expand)"}
        </button>
      </div>
    </div>
  );
}

function CollapsibleText({ text, maxLines = 5 }: { text: string, maxLines?: number }) {
  const [expanded, setExpanded] = useState(false);
  
  if (!text) return null;
  return (
    <div className="relative text-sm text-neutral-700">
      <div className={expanded ? "" : "line-clamp-6 overflow-hidden max-h-[150px]"}>
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>
      <button 
        onClick={() => setExpanded(!expanded)} 
        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium mt-1"
      >
        {expanded ? "收起" : "展开"}
      </button>
    </div>
  );
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const retrieveRelevantChunks = (fileContent: string, query: string, maxChars: number = 1000): string => {
  if (!fileContent) return "";
  if (fileContent.length <= maxChars) return fileContent;

  const paragraphs = fileContent.split(/\n\s*\n+/).map(p => p.trim()).filter(Boolean);
  if (paragraphs.length <= 1) {
    const lines = fileContent.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length <= 1) return fileContent.substring(0, maxChars);
    return lines.slice(0, 15).join("\n");
  }

  const keywords = query
    .toLowerCase()
    .split(/[\s,，.。!！?？;；:：""''()（）[\]{}【】\-_]+/g)
    .filter(w => w.length >= 2);

  if (keywords.length === 0) {
    return paragraphs.slice(0, 3).join("\n\n").substring(0, maxChars);
  }

  const scoredParagraphs = paragraphs.map(p => {
    const pLower = p.toLowerCase();
    let score = 0;
    keywords.forEach(kw => {
      if (pLower.includes(kw)) {
        score += 1;
        score += (pLower.split(kw).length - 1) * 0.5;
      }
    });
    return { text: p, score };
  });

  scoredParagraphs.sort((a, b) => b.score - a.score);

  let result = "";
  for (const item of scoredParagraphs) {
    if (item.score === 0 && result.length > 0) break;
    if (result.length + item.text.length + 2 > maxChars) {
      if (result.length === 0) result = item.text.substring(0, maxChars);
      break;
    }
    result += (result ? "\n\n" : "") + item.text;
  }
  return result || fileContent.substring(0, maxChars);
};

interface Props {
  topic: string;
  philosophers: Philosopher[];
  apiConfig: ApiConfig;
  language: Language;
  stage: Stage;
  setStage: (stage: Stage) => void;
  messages: Message[];
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  summaries: Summary[];
  setSummaries: React.Dispatch<React.SetStateAction<Summary[]>>;
  onSaveSession?: (name: string) => void;
  sessionName?: string;
  onEnd: () => void;
  user: UserInfo | null;
  mode: SessionMode;
}

export default function RoundtableScreen({
  topic,
  philosophers,
  apiConfig,
  language,
  stage,
  setStage,
  messages,
  setMessages,
  summaries,
  setSummaries,
  onSaveSession,
  sessionName = '',
  onEnd,
  user,
  mode
}: Props) {
  const [role, setRole] = useState<Role>('participant');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [targetSpeaker, setTargetSpeaker] = useState<string | null>(null);
  const [socraticQuestions, setSocraticQuestions] = useState<string[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [followUpStates, setFollowUpStates] = useState<Record<string, boolean>>({});
  
  const [activeFollowUpId, setActiveFollowUpId] = useState<string | null>(null);
  const [followUpInput, setFollowUpInput] = useState('');


  const spokenPhilosophersSet = new Set(messages.map(m => m.author));
  const languageIsZh = language === 'zh';
  const unSpokenPhilosophers = philosophers.filter(p => !spokenPhilosophersSet.has(languageIsZh ? p.name : p.nameEn));

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isGeneratingRef = useRef<boolean>(false);
  const [leftWidth, setLeftWidth] = useState(256);
  const [rightWidth, setRightWidth] = useState(288);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [tempSessionName, setTempSessionName] = useState('');
  const [shareToCloud, setShareToCloud] = useState(false);
  
  const [selectedSummary, setSelectedSummary] = useState<{ id: string, messageIndex: number, text: string, title: string } | null>(null);
  const [includeSummariesInDownload, setIncludeSummariesInDownload] = useState(true);
  const [isLeftResizing, setIsLeftResizing] = useState(false);
  const [isRightResizing, setIsRightResizing] = useState(false);
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isLeftResizing) {
        setLeftWidth(Math.max(200, Math.min(e.clientX, 600)));
      } else if (isRightResizing) {
        setRightWidth(Math.max(200, Math.min(window.innerWidth - e.clientX, 600)));
      }
    };
    const handleMouseUp = () => {
      setIsLeftResizing(false);
      setIsRightResizing(false);
    };
    if (isLeftResizing || isRightResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isLeftResizing, isRightResizing]);
  
  const generateSummary = async () => {
    if (messages.length === 0) return;
    setIsSummarizing(true);
    try {
      const response = await fetch('/api/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-config': JSON.stringify(apiConfig),
          'x-app-language': language
        },
        body: JSON.stringify({
          topic,
          messages,
          mode
        })
      });
      if (!response.ok) throw new Error('API Error');
      const data = await response.json();
      setSummaries(prev => [...prev, {
        id: Date.now().toString(),
        messageIndex: messages.length,
        text: data.summary,
        title: (language === 'zh' ? `在第 ${messages.length} 次会话后的总结` : `Summary after ${messages.length} messages`)
      }]);
    } catch (error) {
      console.error(error);
      alert('Error generating summary');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleSave = async (name: string) => {
    onSaveSession?.(name);
    setIsSaveModalOpen(false);
    setIsSaved(true);

    // Upload to cloud if checkbox checked and user logged in
    if (shareToCloud && user) {
      try {
        const sessionObj = {
          id: Date.now().toString(),
          name: name || sessionName || (language === 'zh' ? `会话 ${new Date().toLocaleDateString()}` : `Session ${new Date().toLocaleDateString()}`),
          date: new Date().toISOString(),
          topic,
          philosophers,
          stage,
          messages,
          summaries,
          mode
        };
        const res = await fetch('/api/sessions/share', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.token}`
          },
          body: JSON.stringify({ session: sessionObj })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error('Failed to upload session to cloud:', err.error);
        }
      } catch (e) {
        console.error('Failed to upload session to cloud:', e);
      }
    }
    setShareToCloud(false);
    setTimeout(() => setIsSaved(false), 2000);
  };


  const isZh = language === 'zh';
  const t = {
    stageOpening: isZh ? '阶段一：开场陈述' : 'Stage 1: Opening Statements',
    stageFree: isZh ? '阶段二：自由交锋' : 'Stage 2: Free Debate',
    stageClosing: isZh ? '阶段三：总结陈词' : 'Stage 3: Closing Statements',
    nextStage: isZh ? '进入下一阶段' : 'Next Stage',
    participant: isZh ? '参与者' : 'Participant',
    host: isZh ? '主持人' : 'Host',
    end: isZh ? '结束' : 'End',
    participantsLabel: isZh ? '与会哲学家' : 'Philosophers',
    callToSpeak: isZh ? '点名发言' : 'Ask to Speak',
    eagerToSpeak: isZh ? '渴望发言' : 'Eager to Speak',
    followUp: isZh ? '追问' : 'Follow up',
    thinking: isZh ? '正在沉思...' : 'Thinking...',
    cancel: isZh ? '取消' : 'Cancel',
    send: isZh ? '发送' : 'Send',
    socratic: isZh ? '苏格拉底式提问' : 'Socratic Questions',
    generateQuestions: isZh ? '生成启发式问题' : 'Generate Questions',
    mindmap: isZh ? '思维流' : 'Mind Map',
    noRelations: isZh ? '暂无明显的分歧或赞同关系' : 'No clear relations yet',
    agree: isZh ? '赞同' : 'Agrees with',
    disagree: isZh ? '反驳' : 'Disagrees with',
    supplement: isZh ? '补充' : 'Adds to',
    question: isZh ? '质疑' : 'Questions',
    continueListening: isZh ? '继续听哲学家发言' : 'Listen to next philosopher',
    continueListeningSingle: isZh ? '继续对话' : 'Continue Dialogue',
    hostPlaceholder: isZh ? "作为主持人发言 (引导话题，总结等)..." : "Speak as Host (guide, summarize)...",
    participantPlaceholder: isZh ? "输入你的观点... (输入 @哲学家名字 指定回应)" : "Your thought... (use @Name to mention)",
    chatPlaceholder: isZh ? "向哲学家提问或分享你的想法..." : "Ask the philosopher a question or share your thoughts...",
    followUpPlaceholder: isZh ? "输入你想追问的内容或新观点..." : "Enter your follow-up or new perspective...",
    hostName: isZh ? '主持人' : 'Host',
    participantName: isZh ? '参与者 (我)' : 'Participant (Me)',
    chatUserName: isZh ? '我' : 'Me',
    download: isZh ? '下载对话记录' : 'Download Chat',
    chatMode: isZh ? '对话模式' : 'Dialogue Mode',
    detailLabel: isZh ? '观点' : 'Viewpoint',
    startConversation: isZh ? '开始与哲学家对话' : 'Start Conversation',
  };

  const handleDownload = () => {
    let text = '';
    messages.forEach((m, idx) => {
      text += `[${m.author}]:\n${m.content}\n\n---\n`;
      if (includeSummariesInDownload) {
        const sum = summaries.find(s => s.messageIndex === idx + 1);
        if (sum) {
          text += `\n[DEBATE SUMMARY]:\n${sum.text}\n\n---\n`;
        }
      }
    });
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roundtable_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Determine eager speaker
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const eagerSpeaker = lastMessage?.nextEagerSpeaker;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, activeFollowUpId]);

  // Auto-play opening stage until everyone has spoken
  useEffect(() => {
    if (mode === 'chat' && stage === 'chat' && messages.length === 0 && !isLoading) {
      // Chat mode: philosopher starts with a greeting
      triggerNextPhilosopher();
      return;
    }
    if (stage === 'opening' && !isLoading) {
      const spokenPhilosophers = new Set(messages.map(m => m.author));
      const languageIsZh = language === 'zh';
      const unSpoken = philosophers.filter(p => !spokenPhilosophers.has(languageIsZh ? p.name : p.nameEn));
      if (unSpoken.length > 0) {
        // Auto trigger the next unspoken philosopher
        triggerNextPhilosopher();
      } else if (messages.length > 0) {
        // Everyone has spoken. Wait for user to speak before advancing.
        if (messages[messages.length - 1].role === 'user') {
          setStage('free');
        }
      }
    }
  }, [stage, messages.length, isLoading, mode]);


  // Auto-trigger next philosopher if user just @-mentioned someone and they replied
  useEffect(() => {
    if (mode === 'chat') return; // Chat mode doesn't auto-trigger

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

  const triggerNextPhilosopher = async (target?: string) => {
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;
    setIsLoading(true);
    try {
      let finalTarget = target || targetSpeaker || eagerSpeaker || undefined;

      if (mode !== 'chat' && stage === 'opening' && !target) {
        const spokenPhilosophers = new Set(messages.map(m => m.author));
        const languageIsZh = language === 'zh';
        const unSpoken = philosophers.filter(p => !spokenPhilosophers.has(languageIsZh ? p.name : p.nameEn));
        if (unSpoken.length > 0) {
          finalTarget = languageIsZh ? unSpoken[0].name : unSpoken[0].nameEn;
        } else {
          // If everyone has spoken, advance to free debate
          setStage('free');
        }
      }

      // Chat mode: always target the single philosopher
      if (mode === 'chat') {
        const p = philosophers[0];
        finalTarget = isZh ? p.name : p.nameEn;
      }
      
      const lastMessageContent = messages.length > 0 ? messages[messages.length - 1].content : "";
      const query = `${topic} ${lastMessageContent}`;
      const payloadPhilosophers = philosophers.map(p => {
        if (!p.fileContent) return p;
        return {
          ...p,
          fileContent: retrieveRelevantChunks(p.fileContent, query, 1000)
        };
      });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-config': JSON.stringify(apiConfig),
          'x-app-language': language
        },
        body: JSON.stringify({
          topic,
          philosophers: payloadPhilosophers,
          messages,
          currentStage: stage === 'opening' ? 'Opening statements' : stage === 'free' ? 'Free debate' : stage === 'closing' ? 'Closing statements' : 'Chat',
          targetPhilosopher: finalTarget,
          mode
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'API Error');
      }

      const data = await response.json();
      
      const newMessage: Message = {
        id: Date.now().toString(),
        role: 'philosopher',
        author: data.speaker,
        content: data.content,
        stage,
        relations: data.relations,
        nextEagerSpeaker: data.nextEagerSpeaker,
        timestamp: Date.now(),
        tokensUsed: data.tokensUsed
      };

      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.author === data.speaker && lastMsg.role === 'philosopher') {
          // Check similarity
          const words1 = new Set(lastMsg.content.split(/[\s,\uff0c\.\u3002!\uff01\?\uff1f]+/));
          const words2 = new Set(data.content.split(/[\s,\uff0c\.\u3002!\uff01\?\uff1f]+/));
          const intersection = new Set([...words1].filter(x => words2.has(x)));
          const union = new Set([...words1, ...words2]);
          const score = intersection.size / (union.size || 1);
          
          if (score > 0.7 || lastMsg.content.includes(data.content) || data.content.includes(lastMsg.content)) {
            // Too similar, discard new message
            return prev;
          } else if (score > 0.3) {
            // Somewhat similar, merge
            const merged = { ...lastMsg, content: lastMsg.content + '\n\n' + data.content };
            return [...prev.slice(0, -1), merged];
          }
        }
        return [...prev, newMessage];
      });
      setTargetSpeaker(null);
    } catch (error: any) {
      console.error(error);
      alert(error.message || '生成对话时出错，请重试');
    } finally {
      setIsLoading(false);
      isGeneratingRef.current = false;
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      author: mode === 'chat' ? t.chatUserName : (role === 'host' ? t.hostName : t.participantName),
      content: input.trim(),
      stage,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, newMessage]);
    setInput('');

    if (mode === 'chat') {
      // Chat mode: always trigger the philosopher to respond
      triggerNextPhilosopher();
    } else {
      // Check if the user mentioned a philosopher
      const mentioned = philosophers.find(p => input.includes(`@${isZh ? p.name : p.nameEn}`));
      if (mentioned) {
        setTargetSpeaker(isZh ? mentioned.name : mentioned.nameEn);
        triggerNextPhilosopher(isZh ? mentioned.name : mentioned.nameEn);
      } else {
        if (stage === 'closing' || stage === 'free') {
          triggerNextPhilosopher();
        }
      }
    }
  };

  const handleFollowUpSubmit = async (message: Message) => {
    if (!followUpInput.trim()) return;
    
    setActiveFollowUpId(null);
    setFollowUpStates(prev => ({ ...prev, [message.id]: true }));
    
    // Add user's question to the chat first
    const userQ: Message = {
      id: Date.now().toString(),
      role: 'user',
      author: t.participantName,
      content: `@[${message.author}] ${followUpInput.trim()}`,
      stage,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userQ]);
    
    try {
      const response = await fetch('/api/followup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-config': JSON.stringify(apiConfig),
          'x-app-language': language
        },
        body: JSON.stringify({
          philosopher: message.author,
          content: message.content,
          topic,
          userFollowUpInput: followUpInput.trim()
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Follow-up API Error');
      }
      
      const data = await response.json();
      
      const followupMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'philosopher',
        author: message.author,
        content: data.content,
        stage,
        timestamp: Date.now(),
        tokensUsed: data.tokensUsed
      };
      setMessages(prev => [...prev, followupMsg]);
    } catch (error: any) {
      console.error(error);
      alert(error.message || '追问失败');
    } finally {
      setFollowUpStates(prev => ({ ...prev, [message.id]: false }));
      setFollowUpInput('');
    }
  };

  const generateSocraticQuestions = async () => {
    setLoadingQuestions(true);
    try {
      const response = await fetch('/api/socratic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-config': JSON.stringify(apiConfig),
          'x-app-language': language
        },
        body: JSON.stringify({ topic, messages })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Socratic API Error');
      }
      const data = await response.json();
      setSocraticQuestions(data.questions);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error generating questions');
    } finally {
      setLoadingQuestions(false);
    }
  };

  const nextStage = () => {
    if (stage === 'opening') setStage('free');
    else if (stage === 'free') setStage('closing');
  };

  const getPhilosopherColor = (name: string) => {
    const p = philosophers.find(ph => ph.name === name || ph.nameEn === name);
    return p?.color || '#52525b'; // default zinc-600
  };
  
  const getPhilosopherDisplay = (name: string) => {
    const p = philosophers.find(ph => ph.name === name || ph.nameEn === name);
    if (!p) return name;
    return isZh ? p.name : p.nameEn;
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-neutral-50">
      {/* Summary Modal */}
      <AnimatePresence>
        {selectedSummary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-12">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
              onClick={() => setSelectedSummary(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-neutral-100 bg-neutral-50/50">
                <h3 className="font-semibold text-neutral-800">{selectedSummary.title}</h3>
                <button 
                  onClick={() => setSelectedSummary(null)}
                  className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200 rounded-md transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto">
                <div className="prose prose-sm md:prose-base prose-indigo max-w-none">
                  <ReactMarkdown>{selectedSummary.text}</ReactMarkdown>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between shrink-0 z-10">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 font-serif flex items-center gap-2">
            {mode === 'chat' ? (
              <MessageCircle className="w-5 h-5 text-neutral-700" />
            ) : (
              <BookOpen className="w-5 h-5 text-neutral-700" />
            )}
            {mode === 'chat' && philosophers.length > 0 ? (
              isZh ? philosophers[0].name : philosophers[0].nameEn
            ) : topic}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            {mode === 'chat' ? (
              <span className="text-xs font-medium px-2 py-1 rounded-md bg-indigo-100 text-indigo-800">
                {t.chatMode}
              </span>
            ) : (
              <span className={cn(
                "text-xs font-medium px-2 py-1 rounded-md",
                stage === 'opening' ? "bg-amber-100 text-amber-800" :
                stage === 'free' ? "bg-blue-100 text-blue-800" :
                "bg-purple-100 text-purple-800"
              )}>
                {stage === 'opening' ? t.stageOpening : stage === 'free' ? t.stageFree : t.stageClosing}
              </span>
            )}
            {!mode || mode === 'debate' ? (
              <>
                {role === 'host' && stage !== 'closing' && (
                  <button
                    onClick={nextStage}
                    className="text-xs text-neutral-500 hover:text-neutral-900 flex items-center gap-1 transition-colors"
                  >
                    {t.nextStage} <Play className="w-3 h-3" />
                  </button>
                )}
              </>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {(mode === 'debate') && (
          <div className="flex bg-neutral-100 p-1 rounded-lg">
            <button
              onClick={() => setRole('participant')}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-all",
                role === 'participant' ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500 hover:text-neutral-700"
              )}
            >
              <User className="w-4 h-4" /> {t.participant}
            </button>
            <button
              onClick={() => setRole('host')}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-all",
                role === 'host' ? "bg-neutral-900 shadow-sm text-white" : "text-neutral-500 hover:text-neutral-700"
              )}
            >
              <Crown className="w-4 h-4" /> {t.host}
            </button>
          </div>
          )}
          
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-neutral-600 bg-white border border-neutral-200 px-2 py-1.5 rounded-md cursor-pointer hover:bg-neutral-50 transition-colors">
              <input type="checkbox" checked={includeSummariesInDownload} onChange={e => setIncludeSummariesInDownload(e.target.checked)} className="rounded border-neutral-300" />
              {isZh ? '包含总结' : 'Include Summaries'}
            </label>
            <button onClick={handleDownload} className="text-sm font-medium px-3 py-1.5 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 rounded-md transition-colors">
              {t.download}
            </button>
          </div>

          
          <button
            onClick={() => {
              setTempSessionName(sessionName || '');
              setShareToCloud(false);
              setIsSaveModalOpen(true);
            }} 
            className={cn(
              "text-sm font-medium px-4 py-1.5 rounded-md flex items-center gap-1.5 transition-all shadow-sm",
              isSaved 
                ? "bg-green-500 text-white hover:bg-green-600" 
                : "bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow"
            )}
          >
            {isSaved ? (
              <>
                <Check className="w-4 h-4" />
                {isZh ? '已保存' : 'Saved'}
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isZh ? '保存进度' : 'Save Progress'}
              </>
            )}
          </button>

          <button onClick={onEnd} className="text-sm text-neutral-500 hover:text-neutral-900 underline underline-offset-4">
            {t.end}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        
        
        {/* Left Sidebar */}
        <div style={{ width: leftWidth }} className="border-r border-neutral-200 bg-white flex flex-col shrink-0 relative">
          <div 
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-300 z-10 transition-colors"
            onMouseDown={() => setIsLeftResizing(true)}
          />

          <div className="p-4 border-b border-neutral-100">
            <h3 className="text-sm font-semibold text-neutral-900">
              {mode === 'chat' ? (languageIsZh ? '对话对象' : 'Conversation Partner') : t.participantsLabel}
            </h3>
          </div>
          <div className="p-2 flex-1 overflow-y-auto">
            {philosophers.map(p => {
              const displayName = isZh ? p.name : p.nameEn;
              const isEager = eagerSpeaker === p.name || eagerSpeaker === p.nameEn;
              return (
                <div key={p.id} className={cn("p-3 rounded-lg transition-colors group relative", isEager ? "bg-amber-50" : "hover:bg-neutral-50")}>
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-base" style={{ color: p.color }}>{displayName}</div>
                    {mode === 'debate' && isEager && (
                      <button 
                        onClick={() => triggerNextPhilosopher(displayName)}
                        className="flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                        title={t.callToSpeak}
                      >
                        <Hand className="w-3 h-3" /> {t.eagerToSpeak}
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-neutral-500 line-clamp-1 mt-1">{isZh ? p.description : p.descriptionEn}</div>
                  {mode === 'debate' && role === 'host' && (
                    <div className="mt-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => triggerNextPhilosopher(displayName)}
                        className="text-xs px-2 py-1 bg-white border border-neutral-200 hover:bg-neutral-100 rounded text-neutral-700 flex items-center gap-1 shadow-sm"
                      >
                        <Target className="w-3 h-3" /> {t.callToSpeak}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

            {messages.length > 0 && (
              <div className="mt-4 p-3 border-t border-neutral-100">
                <button 
                  onClick={generateSummary}
                  disabled={isSummarizing}
                  className="w-full py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  {isSummarizing ? (isZh ? "生成中..." : "Summarizing...") : (isZh ? "总结当前辩论" : "Summarize Debate")}
                </button>
                
                {summaries.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {summaries.map(s => (
                      <div key={s.id} className="p-3 bg-white border border-neutral-200 rounded-lg shadow-sm hover:border-indigo-300 transition-colors cursor-pointer" onClick={() => setSelectedSummary(s)}>
                        <h4 className="text-xs font-bold text-neutral-800 mb-1">{s.title}</h4>
                        <div className="line-clamp-2 text-xs text-neutral-500">{s.text}</div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            )}

        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-neutral-50 relative">
          <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-32">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex flex-col max-w-3xl",
                    msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                  )}
                >
                  {msg.role === 'philosopher' ? (
                    <span 
                      className="text-sm font-bold mb-1 ml-1" 
                      style={{ color: getPhilosopherColor(msg.author) }}
                    >
                      {getPhilosopherDisplay(msg.author)}
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-500 mb-1 mr-1 font-medium">{msg.author}</span>
                  )}
                  
                  <div className={cn(
                    "px-5 py-4 rounded-2xl shadow-sm text-sm md:text-base leading-relaxed",
                    msg.role === 'user' 
                      ? "bg-neutral-900 text-white rounded-br-sm" 
                      : "bg-white text-neutral-800 border border-neutral-200 rounded-bl-sm"
                  )}>
                    {msg.role === 'philosopher' ? (
                      <div className="prose prose-sm md:prose-base prose-neutral max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                        {msg.tokensUsed && (
                          <div className="text-[10px] text-neutral-400 mt-2 text-right">
                            Tokens used: {msg.tokensUsed}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    )}
                  </div>
                  
                  {msg.role === 'philosopher' && (
                    <div className="flex flex-col w-full mt-2 ml-1">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => {
                            if (activeFollowUpId === msg.id) {
                              setActiveFollowUpId(null);
                            } else {
                              setActiveFollowUpId(msg.id);
                              setFollowUpInput('');
                            }
                          }}
                          disabled={followUpStates[msg.id]}
                          className="text-xs text-neutral-500 hover:text-neutral-900 flex items-center gap-1 transition-colors"
                        >
                          <MessageCircleQuestion className="w-3.5 h-3.5" />
                          {followUpStates[msg.id] ? t.thinking : t.followUp}
                        </button>
                        
                        {/* Show relations if exist */}
                        {msg.relations && msg.relations.length > 0 && (
                          <div className="flex gap-1">
                            {msg.relations.map((r, i) => (
                              <span key={i} className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded-full border",
                                r.type === 'agree' ? "bg-green-50 border-green-200 text-green-700" :
                                r.type === 'disagree' ? "bg-red-50 border-red-200 text-red-700" :
                                "bg-blue-50 border-blue-200 text-blue-700"
                              )}>
                                {r.type === 'agree' ? t.agree : r.type === 'disagree' ? t.disagree : t.supplement} @{getPhilosopherDisplay(r.target)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Active Follow-up Input Box */}
                      {activeFollowUpId === msg.id && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-3 bg-white p-3 border border-neutral-200 rounded-xl shadow-sm w-full max-w-lg"
                        >
                          <textarea
                            value={followUpInput}
                            onChange={(e) => setFollowUpInput(e.target.value)}
                            placeholder={t.followUpPlaceholder}
                            className="w-full bg-neutral-50 border border-neutral-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-neutral-900 outline-none resize-none"
                            rows={2}
                            autoFocus
                          />
                          <div className="flex justify-end gap-2 mt-2">
                            <button
                              onClick={() => setActiveFollowUpId(null)}
                              className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-md"
                            >
                              {t.cancel}
                            </button>
                            <button
                              onClick={() => handleFollowUpSubmit(msg)}
                              disabled={!followUpInput.trim()}
                              className="px-3 py-1.5 text-xs font-medium bg-neutral-900 text-white rounded-md hover:bg-neutral-800 disabled:opacity-50"
                            >
                              {t.send}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {isLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2 p-4 max-w-[100px] bg-white border border-neutral-200 rounded-2xl rounded-bl-sm">
                <div className="w-2 h-2 rounded-full bg-neutral-300 animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-neutral-300 animate-bounce" style={{ animationDelay: '0.2s' }} />
                <div className="w-2 h-2 rounded-full bg-neutral-300 animate-bounce" style={{ animationDelay: '0.4s' }} />
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="absolute bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-neutral-200 p-4">
            {mode !== 'chat' && stage === 'free' && !isLoading && (
              <div className="flex justify-center mb-4">
                <button
                  onClick={() => triggerNextPhilosopher()}
                  className="px-6 py-2.5 bg-neutral-900 text-white rounded-full font-medium shadow-md hover:bg-neutral-800 hover:shadow-lg transition-all flex items-center gap-2 text-sm"
                >
                  <Target className="w-4 h-4" />
                  {t.continueListening} {eagerSpeaker && `(${getPhilosopherDisplay(eagerSpeaker)} ${t.eagerToSpeak})`}
                </button>
              </div>
            )}
            {mode === 'chat' && messages.length === 0 && !isLoading && (
              <div className="flex justify-center mb-4">
                <button
                  onClick={() => triggerNextPhilosopher()}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-full font-medium shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all flex items-center gap-2 text-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  {t.startConversation}
                </button>
              </div>
            )}
            <div className="max-w-4xl mx-auto relative flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={
                    mode === 'chat'
                      ? t.chatPlaceholder
                      : (stage === 'opening' && unSpokenPhilosophers.length === 0
                        ? (isZh ? '请发表您的观点以进入自由交锋阶段（或手动进入下一阶段）...' : 'Share your view to enter free debate (or proceed manually)...')
                        : (role === 'host' ? t.hostPlaceholder : t.participantPlaceholder))
                  }
                  className="w-full pl-4 pr-12 py-3 max-h-32 min-h-[52px] bg-white border border-neutral-300 shadow-sm rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 outline-none resize-none transition-all"
                  rows={1}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 bottom-2 p-1.5 text-neutral-400 hover:text-neutral-900 disabled:opacity-50 transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        
        {/* Right Sidebar */}
        <div style={{ width: rightWidth }} className="border-l border-neutral-200 bg-white flex flex-col shrink-0 relative">
          <div 
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-300 z-10 transition-colors"
            onMouseDown={() => setIsRightResizing(true)}
          />

          <div className="p-4 border-b border-neutral-100">
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <Lightbulb className="w-4 h-4" /> {t.socratic}
            </h3>
          </div>
          <div className="p-4 flex flex-col gap-4">
            <button
              onClick={generateSocraticQuestions}
              disabled={loadingQuestions || messages.length < 2}
              className="w-full py-2 px-3 text-sm font-medium rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 transition-colors"
            >
              {loadingQuestions ? t.thinking : t.generateQuestions}
            </button>

            {socraticQuestions.length > 0 && (
              <div className="space-y-2">
                {socraticQuestions.map((q, i) => (
                  <div 
                    key={i} 
                    onClick={() => setInput(q)}
                    className="p-3 bg-neutral-50 border border-neutral-100 rounded-lg text-sm text-neutral-700 cursor-pointer hover:border-neutral-300 hover:bg-neutral-100 transition-colors"
                  >
                    {q}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-4 border-t border-b border-neutral-100 mt-auto">
            <h3 className="text-sm font-semibold text-neutral-900 mb-3">{t.mindmap}</h3>
            <CollapsibleSection>
            <div className="space-y-2">
              {messages.filter(m => m.relations && m.relations.length > 0).map(m => (
                <div key={`rel-${m.id}`} className="text-xs p-3 bg-neutral-50 rounded-lg border border-neutral-100">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="font-bold text-neutral-800" style={{ color: getPhilosopherColor(m.author) }}>
                      {getPhilosopherDisplay(m.author)}
                    </span>
                  </div>
                  {m.relations?.map((r, i) => (
                    <div key={i} className="mb-1 ml-2 border-l-2 pl-2" style={{ borderColor: r.type === 'agree' ? '#22c55e' : r.type === 'disagree' ? '#ef4444' : '#3b82f6' }}>
                      <div className="flex items-center gap-1">
                        <span className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                          r.type === 'agree' ? "bg-green-100 text-green-700" :
                          r.type === 'disagree' ? "bg-red-100 text-red-700" :
                          r.type === 'question' ? "bg-amber-100 text-amber-700" :
                          "bg-blue-100 text-blue-700"
                        )}>
                          {r.type === 'agree' ? t.agree : r.type === 'disagree' ? t.disagree : r.type === 'question' ? t.question : t.supplement}
                        </span>
                        <span className="font-semibold text-neutral-700" style={{ color: getPhilosopherColor(r.target) }}>
                          {getPhilosopherDisplay(r.target)}
                        </span>
                      </div>
                      {r.detail && (
                        <p className="text-neutral-500 mt-0.5 ml-0.5 leading-relaxed">
                          {r.detail}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ))}
              {messages.filter(m => m.relations && m.relations.length > 0).length === 0 && (
                <div className="text-xs text-neutral-400 text-center py-4">
                  {t.noRelations}
                </div>
              )}
            </div>
            </CollapsibleSection>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isSaveModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-4 border-b border-neutral-100 flex justify-between items-center">
                <h3 className="font-semibold text-neutral-900">
                  {isZh ? '保存会话' : 'Save Session'}
                </h3>
                <button onClick={() => setIsSaveModalOpen(false)} className="text-neutral-400 hover:text-neutral-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  {isZh ? '会话名称' : 'Session Name'}
                </label>
                <input
                  type="text"
                  value={tempSessionName}
                  onChange={e => setTempSessionName(e.target.value)}
                  placeholder={isZh ? '留空则使用默认日期' : 'Leave blank for default date'}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm outline-none focus:border-neutral-800 transition-colors"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleSave(tempSessionName);
                    }
                  }}
                />
                {/* Cloud upload checkbox - only for logged-in users */}
                {user && (
                  <label className="flex items-center gap-2 mt-3 p-2.5 bg-indigo-50 border border-indigo-100 rounded-lg cursor-pointer hover:bg-indigo-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={shareToCloud}
                      onChange={(e) => setShareToCloud(e.target.checked)}
                      className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-medium text-indigo-700 flex items-center gap-1">
                      <Upload className="w-3.5 h-3.5" />
                      {isZh ? '上传到云端（仅自己可见）' : 'Upload to cloud (private)'}
                    </span>
                  </label>
                )}
              </div>
              <div className="p-4 bg-neutral-50 flex justify-end gap-2 border-t border-neutral-100">
                <button
                  onClick={() => { setIsSaveModalOpen(false); setShareToCloud(false); }}
                  className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-200 rounded-lg transition-colors"
                >
                  {isZh ? '取消' : 'Cancel'}
                </button>
                <button
                  onClick={() => handleSave(tempSessionName)}
                  className="px-4 py-2 text-sm font-medium bg-neutral-900 text-white hover:bg-neutral-800 rounded-lg transition-colors"
                >
                  {isZh ? '保存' : 'Save'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
