import { useState, useEffect } from 'react';
import SetupScreen from './components/SetupScreen';
import RoundtableScreen from './components/RoundtableScreen';
import AuthModal from './components/AuthModal';
import { Stage, Philosopher, Message, ApiConfig, Language, SavedSession, Summary, UserInfo, SessionMode } from './types';

export default function App() {
  const [stage, setStage] = useState<Stage>('setup');
  const [topic, setTopic] = useState('');
  const [philosophers, setPhilosophers] = useState<Philosopher[]>([]);
  const [mode, setMode] = useState<SessionMode>('debate');
  const [apiConfig, setApiConfig] = useState<ApiConfig>({ provider: 'deepseek', key: '' });
  const [messages, setMessages] = useState<Message[]>([]);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState<string>('');
  const [language, setLanguage] = useState<Language>('zh');
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Load API config and user from local storage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('api_config');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        // Migrate old gemini default to deepseek
        if (!parsed.provider || parsed.provider === 'gemini') {
          parsed.provider = 'deepseek';
        }
        setApiConfig(parsed);
      } catch (e) {
        const savedKey = localStorage.getItem('gemini_api_key');
        if (savedKey) setApiConfig({ provider: 'deepseek', key: savedKey });
      }
    } else {
        const savedKey = localStorage.getItem('gemini_api_key');
        if (savedKey) setApiConfig({ provider: 'deepseek', key: savedKey });
    }

    const savedLang = localStorage.getItem('app_language');
    if (savedLang === 'zh' || savedLang === 'en') {
      setLanguage(savedLang);
    }

    const savedUser = localStorage.getItem('philo_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
      } catch (e) {}
    }
  }, []);

  const handleStart = (selectedTopic: string, selectedPhilosophers: Philosopher[], config: ApiConfig, lang: Language, selectedMode: SessionMode, restoreSessionId?: string, restoreMessages?: Message[], restoreSummaries?: Summary[], restoreStage?: Stage, restoreName?: string, restoreMode?: SessionMode) => {
    if (restoreSessionId) {
      setSessionId(restoreSessionId);
      setSessionName(restoreName || '');
      setMessages(restoreMessages || []);
      setSummaries(restoreSummaries || []);
      setStage(restoreStage || 'opening');
      setMode(restoreMode || 'debate');
    } else {
      setSessionId(null);
      setSessionName('');
      setMessages([]);
      setSummaries([]);
      setMode(selectedMode);
    }
    setTopic(selectedTopic);
    setPhilosophers(selectedPhilosophers);
    setApiConfig(config);
    setLanguage(lang);
    localStorage.setItem('api_config', JSON.stringify(config));
    localStorage.setItem('app_language', lang);
    if (!restoreSessionId) setStage(selectedMode === 'chat' ? 'chat' : 'opening');
  };


  const handleSaveSession = (name: string) => {
    const id = sessionId || Date.now().toString();
    const session: SavedSession = {
      id,
      name: name || sessionName || (language === 'zh' ? `会话 ${new Date().toLocaleDateString()}` : `Session ${new Date().toLocaleDateString()}`),
      date: new Date().toISOString(),
      topic,
      philosophers,
      stage,
      messages,
      summaries,
      mode
    };
    
    const saved = localStorage.getItem('saved_sessions');
    let sessions: SavedSession[] = saved ? JSON.parse(saved) : [];
    
    if (sessionId) {
      sessions = sessions.map(s => s.id === id ? session : s);
    } else {
      sessions.push(session);
      setSessionId(id);
    }
    setSessionName(session.name);
    localStorage.setItem('saved_sessions', JSON.stringify(sessions));
  };

  const handleEnd = () => {
    setStage('setup');
    setMessages([]);
    setTopic('');
    setPhilosophers([]);
    setSummaries([]);
    setSessionId(null);
    setSessionName('');
    setMode('debate');
  };

  const handleLogin = (userInfo: UserInfo) => {
    setUser(userInfo);
    localStorage.setItem('philo_user', JSON.stringify(userInfo));
    setIsAuthModalOpen(false);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('philo_user');
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      {stage === 'setup' ? (
        <SetupScreen
          onStart={handleStart}
          initialApiConfig={apiConfig}
          initialLanguage={language}
          user={user}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onLogout={handleLogout}
          initialMode={mode}
        />
      ) : (
        <RoundtableScreen
          topic={topic}
          philosophers={philosophers}
          apiConfig={apiConfig}
          language={language}
          stage={stage}
          setStage={setStage}
          messages={messages}
          setMessages={setMessages}
          summaries={summaries}
          setSummaries={setSummaries}
          onSaveSession={handleSaveSession}
          sessionName={sessionName}
          onEnd={handleEnd}
          user={user}
          mode={mode}
        />
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLogin={handleLogin}
        language={language}
      />
    </div>
  );
}
