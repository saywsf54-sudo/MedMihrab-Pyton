import React, { useState, useEffect, useRef } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { Play, Code, MessageSquare, Terminal, Download, Save, RefreshCw, Sliders, ChevronLeft, ChevronRight, FileText, Sparkles, Maximize2, Minimize2, Key } from 'lucide-react';
import { Button } from './components/ui/button';
import EditorPane from './components/EditorPane';
import ChatPane from './components/ChatPane';
import OutputPane from './components/OutputPane';
import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';
import SmartTextFetcherModal from './components/SmartTextFetcherModal';
import ApiKeyModal from './components/ApiKeyModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import ThemeToggle from './components/ThemeToggle';
import { useTheme } from './hooks/useTheme';

import { 
  executePythonCode, 
  fetchAvailableModels, 
  DEFAULT_ALL_MODELS, 
  ModelOption, 
  AdvancedSettings, 
  DEFAULT_SETTINGS,
  getApiKeyStatus,
  ApiKeyStatus,
  resolveActualModelId
} from './services/geminiService';

export interface ProjectFile {
  id: string;
  name: string;
  content: string;
}

const DEFAULT_FILES: ProjectFile[] = [
  { id: '1', name: 'المخطوطة_الأولى.txt', content: 'بسم الله الرحمن الرحيم\n\nأهلاً بك في منصة "مداد الرحمن".\nيمكنك هنا كتابة نصوصك أو استخدام المساعد الذكي للاستفسار عن القرآن، الحديث، أو البحث في العلوم الإسلامية المختلفة.\n\nاستخدم نافذة "الدردشة الذكية" للبدء!' }
];

const INITIAL_MODELS: ModelOption[] = DEFAULT_ALL_MODELS;

const generateId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export default function App() {
  const { themeMode, setThemeMode } = useTheme();

  const [availableModels, setAvailableModels] = useState<ModelOption[]>(INITIAL_MODELS);
  const [isRefreshingModels, setIsRefreshingModels] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('gemini-lab-selected-model');
      return resolveActualModelId(saved || INITIAL_MODELS[0].id);
    } catch {
      return INITIAL_MODELS[0].id;
    }
  });

  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>(() => getApiKeyStatus());

  const handleUpdateApiKeyStatus = () => {
    setApiKeyStatus(getApiKeyStatus());
  };

  const handleModelChange = (newModel: string) => {
    const resolved = resolveActualModelId(newModel);
    setSelectedModel(resolved);
    try {
      localStorage.setItem('gemini-lab-selected-model', resolved);
    } catch {}
  };

  const [files, setFiles] = useState<ProjectFile[]>(() => {
    try {
      const saved = localStorage.getItem('gemini-lab-files');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_FILES;
  });
  const [activeFileId, setActiveFileId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('gemini-lab-active');
      return saved || '1';
    } catch {
      return '1';
    }
  });

  const activeFile = files.find(f => f.id === activeFileId) || files[0];

  const [output, setOutput] = useState<string>('');
  const [images, setImages] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Responsive Mobile Tab State
  const [activeMobileTab, setActiveMobileTab] = useState<'editor' | 'chat' | 'output' | 'files'>('editor');
  const [focusedPane, setFocusedPane] = useState<'editor' | 'chat' | 'output' | null>(null);

  // Scroll Ref for Top Header Bar
  const headerScrollRef = useRef<HTMLDivElement>(null);

  const scrollHeader = (direction: 'left' | 'right') => {
    if (headerScrollRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      headerScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const [settings, setSettings] = useState<AdvancedSettings>(() => {
    try {
      const saved = localStorage.getItem('gemini-lab-settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSmartFetcherOpen, setIsSmartFetcherOpen] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem('gemini-lab-settings', JSON.stringify(settings));
  }, [settings]);

  const pickPreferredModel = (list: ModelOption[]): string => {
    return (
      list.find(m => m.id === 'gemini-3.6-flash')?.id ||
      list.find(m => m.id === 'gemini-3.8-flash')?.id ||
      list.find(m => m.id === 'gemini-4-hydrogen')?.id ||
      list.find(m => m.id === 'gemini-2.5-flash')?.id ||
      list.find(m => /^gemini-.*flash/i.test(m.id) && !/image|tts|live|audio|omni/i.test(m.id))?.id ||
      list[0].id
    );
  };

  // تحديث النماذج تلقائياً عند فتح التطبيق
  useEffect(() => {
    const loadModels = async () => {
      setIsRefreshingModels(true);
      try {
        const fetched = await fetchAvailableModels();
        if (fetched && fetched.length > 0) {
          setAvailableModels(fetched);
          const isModelValid = fetched.some(m => m.id === selectedModel);
          if (!isModelValid) {
            handleModelChange(pickPreferredModel(fetched));
          }
        }
      } catch (err) {
        console.error("Error updating models list:", err);
      } finally {
        setIsRefreshingModels(false);
      }
    };

    loadModels();
  }, []);

  useEffect(() => {
    localStorage.setItem('gemini-lab-files', JSON.stringify(files));
    localStorage.setItem('gemini-lab-active', activeFileId);
  }, [files, activeFileId]);

  const updateActiveFileContent = (newContent: string) => {
    setFiles(files.map(f => f.id === activeFileId ? { ...f, content: newContent } : f));
  };

  const handleAddFile = () => {
    const newId = generateId();
    const newFile: ProjectFile = {
      id: newId,
      name: `script_${files.length + 1}.py`,
      content: '# New script\n'
    };
    setFiles([...files, newFile]);
    setActiveFileId(newId);
  };

  const handleDeleteFile = (id: string) => {
    if (files.length <= 1) return;
    const newFiles = files.filter(f => f.id !== id);
    setFiles(newFiles);
    if (activeFileId === id) {
      setActiveFileId(newFiles[0].id);
    }
  };

  const handleRenameFile = (id: string, newName: string) => {
    setFiles(files.map(f => f.id === id ? { ...f, name: newName } : f));
  };

  const handleDuplicateFile = (id: string) => {
    const fileToDup = files.find(f => f.id === id);
    if (!fileToDup) return;
    const newId = generateId();
    const extMatch = fileToDup.name.match(/\.[a-z0-9]+$/i);
    const ext = extMatch ? extMatch[0] : '.py';
    const baseName = extMatch ? fileToDup.name.slice(0, -ext.length) : fileToDup.name;
    const newFile: ProjectFile = {
      id: newId,
      name: `${baseName}_copy${ext}`,
      content: fileToDup.content
    };
    setFiles([...files, newFile]);
    setActiveFileId(newId);
  };

  const handleDownloadCode = () => {
    const blob = new Blob([activeFile.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRunCode = async (codeToRun?: string | React.MouseEvent) => {
    const code = typeof codeToRun === 'string' ? codeToRun : activeFile.content;
    if (typeof code !== 'string' || !code.trim() || isRunning) return;
    setIsRunning(true);
    // On small mobile screens, auto-switch to output tab
    if (window.innerWidth < 768) {
      setActiveMobileTab('output');
    }
    let currentOutput = `> جاري التنفيذ (${activeFile.name}) في بيئة Gemini المعزولة باستخدام نموذج ${availableModels.find(m => m.id === selectedModel)?.name || selectedModel}...\n`;
    setOutput(currentOutput);
    setImages([]);
    
    // إعطاء تفاعل للمستخدم إذا تأخر التنفيذ
    const feedbackTimeout1 = setTimeout(() => {
      currentOutput += `\n> (الرجاء الانتظار، جاري معالجة الكود...)`;
      setOutput(currentOutput);
    }, 10000);

    const feedbackTimeout2 = setTimeout(() => {
      currentOutput += `\n> (ما زلنا ننتظر النتيجة، يبدو أن التنفيذ يستغرق وقتاً أطول من المعتاد...)`;
      setOutput(currentOutput);
    }, 25000);
    
    try {
      const timeoutMs = (settings.executionTimeoutSeconds || 45) * 1000;
      const result = await executePythonCode(code, selectedModel, timeoutMs);
      let newOutput = result.text;
      if (result.codeExecutionResult) {
        newOutput += '\n\n' + result.codeExecutionResult;
      }
      setOutput(newOutput);
      if (result.images) {
        setImages(result.images);
      }
    } catch (err: any) {
      const errorMessage = err.message || JSON.stringify(err);
      const stack = err.stack ? `\n\n**تفاصيل الخطأ (Stack Trace):**\n\`\`\`text\n${err.stack}\n\`\`\`` : '';
      setOutput(`**خطأ في التنفيذ:**\n\n${errorMessage}${stack}`);
    } finally {
      clearTimeout(feedbackTimeout1);
      clearTimeout(feedbackTimeout2);
      setIsRunning(false);
    }
  };

  const handleExportResults = () => {
    if (!output && images.length === 0) return;
    let exportContent = `# نتائج تنفيذ ${activeFile.name}\n\n`;
    exportContent += output;
    
    const blob = new Blob([exportContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `results_${activeFile.name.replace('.py', '')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans overflow-hidden transition-colors duration-500" dir="rtl" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/arabesque.png')", backgroundBlendMode: 'multiply' }}>
      {/* Scrollable App Header */}
      {!focusedPane && (
        <header className="h-[56px] sm:h-[60px] border-b border-amber-200/50 dark:border-amber-900/30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md flex items-center shrink-0 px-2 sm:px-3 relative select-none shadow-sm z-10">
          {/* Scroll Nav Arrow - Right (RTL scroll left) */}
          <button
            onClick={() => scrollHeader('left')}
            className="p-1 text-slate-400 dark:text-slate-500 hover:text-amber-700 dark:hover:text-amber-400 bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 rounded-lg shrink-0 shadow-sm border border-amber-100 dark:border-slate-700 z-10 ml-0.5 transition-colors sm:ml-1"
            title="التنقل في الشريط العلوي"
          >
            <ChevronRight size={16} className="sm:w-[18px] sm:h-[18px]" />
          </button>

          {/* Scrollable Container */}
          <div
            ref={headerScrollRef}
            className="flex items-center gap-2 sm:gap-4 overflow-x-auto custom-header-scroll scroll-smooth py-1 w-full flex-nowrap shrink scrollbar-none"
          >
            {/* Logo & Title */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-amber-500 to-amber-700 rounded-xl flex items-center justify-center text-white font-bold tracking-tight shadow-md border border-amber-400/30">
                <Sparkles size={16} className="text-amber-100 sm:w-[20px] sm:h-[20px]" />
              </div>
              <div>
                <h1 className="text-sm sm:text-[17px] font-bold tracking-tight whitespace-nowrap text-amber-900 dark:text-amber-100 font-serif">
                  مكتبة مداد الرحمن
                </h1>
                <p className="text-[10px] font-medium text-amber-700/80 dark:text-amber-400/80 font-sans -mt-0.5 hidden sm:block">
                  الذكاء الاصطناعي في خدمة العلوم الإسلامية
                </p>
              </div>
            </div>

            <div className="h-5 sm:h-6 w-px bg-amber-200 dark:bg-slate-800 shrink-0 mx-1 sm:mx-2" />

            {/* Model Selection Dropdown */}
            <div className="flex items-center gap-1 shrink-0">
              <select
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value)}
                className="text-[11px] sm:text-[12px] px-2 sm:px-3 py-1 sm:py-1.5 bg-amber-50 dark:bg-slate-800 border border-amber-200 dark:border-slate-700 rounded-xl text-amber-900 dark:text-amber-100 outline-none focus:ring-2 focus:ring-amber-500 font-mono font-semibold cursor-pointer max-w-[150px] sm:max-w-[280px] truncate shadow-sm transition-all"
                dir="ltr"
              >
                {availableModels.map(m => (
                  <option key={m.id} value={m.id}>{m.id}</option>
                ))}
              </select>
              <button
                onClick={async () => {
                  setIsRefreshingModels(true);
                  try {
                    const fetched = await fetchAvailableModels(true);
                    if (fetched && fetched.length > 0) {
                      setAvailableModels(fetched);
                      if (!fetched.some(m => m.id === selectedModel)) {
                        handleModelChange(pickPreferredModel(fetched));
                      }
                    }
                  } finally {
                    setIsRefreshingModels(false);
                  }
                }}
                title="تحديث قائمة النماذج من الخادم"
                className="p-1.5 sm:p-2 text-amber-600 dark:text-amber-500 hover:text-amber-800 dark:hover:text-amber-300 hover:bg-amber-100 dark:hover:bg-slate-800 rounded-xl transition-colors shrink-0"
              >
                <RefreshCw size={14} className={`sm:w-[15px] sm:h-[15px] ${isRefreshingModels ? "animate-spin text-amber-600" : ""}`} />
              </button>
            </div>

            <div className="h-5 sm:h-6 w-px bg-amber-200 dark:bg-slate-800 shrink-0 mx-1 sm:mx-2" />

            {/* Theme Toggle Component */}
            <div className="shrink-0 flex items-center">
              <ThemeToggle themeMode={themeMode} onThemeChange={setThemeMode} />
            </div>

            <div className="h-5 sm:h-6 w-px bg-amber-200 dark:bg-slate-800 shrink-0 mx-1 sm:mx-2" />

            {/* Action Buttons */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* API Key Modal Button */}
              <button
                onClick={() => setIsApiKeyModalOpen(true)}
                className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg border text-[10px] sm:text-[11px] font-bold transition-all shadow-2xs shrink-0 ${
                  apiKeyStatus.source === 'custom'
                    ? 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                    : apiKeyStatus.source === 'env'
                    ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700 animate-pulse'
                }`}
                title="إدارة مفتاح Google Gemini API"
              >
                <Key size={13} className={apiKeyStatus.source === 'none' ? 'text-amber-600 dark:text-amber-400' : apiKeyStatus.source === 'custom' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'} />
                <span className="hidden xs:inline">
                  {apiKeyStatus.source === 'custom' ? 'مفتاح مخصص' : apiKeyStatus.source === 'env' ? 'مفتاح مدمج' : 'المفتاح'}
                </span>
                <span className={`w-1.5 h-1.5 rounded-full ${apiKeyStatus.source === 'none' ? 'bg-amber-500' : apiKeyStatus.source === 'custom' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
              </button>

              {/* PWA Install Button */}
              <PWAInstallButton />

              <Button
                onClick={() => setIsSettingsOpen(true)}
                className="bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 h-auto text-[10px] sm:text-[11px] font-bold shadow-2xs transition-all whitespace-nowrap"
              >
                <Sliders size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <span>الإعدادات</span>
              </Button>

              <Button
                onClick={handleRunCode}
                className="bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-lg flex items-center gap-1 px-2.5 sm:px-3.5 py-1 sm:py-1.5 h-auto text-[10px] sm:text-[11px] font-bold border-0 shadow-sm whitespace-nowrap transition-all"
                disabled={isRunning}
              >
                <Play size={13} className="rotate-180 fill-white shrink-0" />
                <span>{isRunning ? 'جاري...' : 'تشغيل المخطوطة'}</span>
              </Button>

              <Button
                onClick={handleDownloadCode}
                className="bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 h-auto text-[10px] sm:text-[11px] font-semibold shadow-2xs whitespace-nowrap"
              >
                <Download size={13} className="shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="hidden sm:inline">حفظ السجل</span>
              </Button>
            </div>
          </div>

          {/* Scroll Nav Arrow - Left (RTL scroll right) */}
          <button
            onClick={() => scrollHeader('right')}
            className="p-1 text-slate-400 dark:text-slate-500 hover:text-amber-700 dark:hover:text-amber-400 bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 rounded-lg shrink-0 shadow-sm border border-amber-100 dark:border-slate-700 z-10 mr-0.5 transition-colors sm:mr-1"
            title="التنقل في الشريط العلوي"
          >
            <ChevronLeft size={16} className="sm:w-[18px] sm:h-[18px]" />
          </button>
        </header>
      )}

      {/* Mobile Device View Switcher Navigation Bar (Visible only on narrow devices < 768px) */}
      {!focusedPane && (
        <div className="flex md:hidden bg-white dark:bg-slate-950 text-slate-500 border-b border-amber-100 dark:border-slate-800 px-1.5 py-1.5 justify-between items-center shrink-0 text-[11px] font-bold shadow-sm gap-1 overflow-x-auto" dir="rtl">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveMobileTab('editor')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all ${
                activeMobileTab === 'editor' ? 'bg-amber-600 text-white shadow-sm' : 'hover:bg-amber-50 dark:hover:bg-slate-800'
              }`}
            >
              <Code size={15} />
              <span>المخطوطة</span>
            </button>

            <button
              onClick={() => setActiveMobileTab('chat')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all relative ${
                activeMobileTab === 'chat' ? 'bg-amber-600 text-white shadow-sm' : 'hover:bg-amber-50 dark:hover:bg-slate-800'
              }`}
            >
              <Sparkles size={15} />
              <span>المداد الذكي</span>
            </button>

            <button
              onClick={() => setActiveMobileTab('output')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all relative ${
                activeMobileTab === 'output' ? 'bg-amber-600 text-white shadow-sm' : 'hover:bg-amber-50 dark:hover:bg-slate-800'
              }`}
            >
              <Terminal size={15} />
              <span>النتائج</span>
              {(output || images.length > 0) && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></span>
              )}
            </button>

            <button
              onClick={() => setActiveMobileTab('files')}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg transition-all ${
                activeMobileTab === 'files' ? 'bg-amber-600 text-white shadow-sm' : 'hover:bg-amber-50 dark:hover:bg-slate-800'
              }`}
            >
              <FileText size={15} />
              <span>المكتبة</span>
            </button>
          </div>

          {/* Mobile Fast Run Button */}
          <button
            onClick={() => {
              handleRunCode();
              setActiveMobileTab('output');
            }}
            disabled={isRunning}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg shadow-sm font-bold text-[11px] shrink-0 transition-all border border-emerald-500/50"
            title="تشغيل المخطوطة والانتقال إلى شاشة النتائج"
          >
            <Play size={13} className="rotate-180 fill-white" />
            <span>{isRunning ? 'جاري...' : 'تشغيل'}</span>
          </button>
        </div>
      )}

      {/* Main Container - Dynamic Split for Desktop vs Dynamic Single-Pane View for Mobile */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Desktop Dynamic Resizable Multi-Pane Workspace */}
        <div className="hidden md:flex flex-1 w-full h-full overflow-hidden relative">
          {!focusedPane && (
            <Sidebar
              files={files}
              activeFileId={activeFileId}
              onFileSelect={setActiveFileId}
              onFileAdd={handleAddFile}
              onFileDelete={handleDeleteFile}
              onFileRename={handleRenameFile}
              onFileDuplicate={handleDuplicateFile}
            />
          )}
          <div className="flex-1 overflow-hidden h-full relative">
            <PanelGroup orientation="horizontal" className="h-full w-full">
              {/* Editor & Chat Panel Group */}
              {focusedPane !== 'output' && (
                <Panel defaultSize={65} minSize={30}>
                  <PanelGroup orientation="vertical" className="h-full w-full border-r border-[#e2e8f0] dark:border-slate-800">
                    {/* Editor Area */}
                    {focusedPane !== 'chat' && (
                      <Panel defaultSize={60} minSize={20}>
                        <div className="h-full flex flex-col bg-slate-900 dark:bg-slate-950 relative">
                          <div className="flex-1 w-full h-full relative z-10" dir="ltr">
                            <EditorPane 
                              code={activeFile.content} 
                              onChange={(val) => updateActiveFileContent(val || '')} 
                              fileName={activeFile.name}
                              onOpenSmartFetcher={() => setIsSmartFetcherOpen(true)}
                              isFocused={focusedPane === 'editor'}
                              onToggleFocus={() => setFocusedPane(focusedPane === 'editor' ? null : 'editor')}
                            />
                          </div>
                        </div>
                      </Panel>
                    )}

                    {!focusedPane && <ResizeHandleHorizontal />}

                    {/* Chat Area */}
                    {focusedPane !== 'editor' && (
                      <Panel defaultSize={40} minSize={20}>
                        <div className="h-full flex flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm relative">
                          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/arabesque.png')] opacity-10 pointer-events-none mix-blend-multiply dark:mix-blend-color-burn"></div>
                          <div className="p-3 border-b border-amber-200/50 dark:border-amber-900/30 text-[13px] font-bold flex justify-between items-center text-amber-900 dark:text-amber-100 bg-amber-50/50 dark:bg-slate-800/50 shadow-sm z-10">
                            <span className="flex items-center gap-2">
                              <MessageSquare size={16} className="text-amber-600 dark:text-amber-500" /> المداد الذكي - {availableModels.find(m => m.id === selectedModel)?.name || selectedModel}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-emerald-600 dark:text-emerald-400 text-[11px] bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50 font-bold flex items-center gap-1.5 shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> مستعد
                              </span>
                              <button onClick={() => setFocusedPane(focusedPane === 'chat' ? null : 'chat')} className="p-1 hover:bg-amber-900/10 dark:hover:bg-amber-100/10 rounded text-amber-700/70 dark:text-amber-400/70 hover:text-amber-600 dark:hover:text-amber-300 transition-colors" title="التركيز العميق">
                                {focusedPane === 'chat' ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                              </button>
                            </div>
                          </div>
                          <div className="flex-1 overflow-hidden z-10">
                            <ChatPane
                              currentCode={activeFile.content}
                              selectedModel={selectedModel}
                              onUpdateCode={updateActiveFileContent}
                              onRunCode={handleRunCode}
                              output={output}
                              images={images}
                              settings={settings}
                              onUpdateSettings={setSettings}
                              onOpenSmartFetcher={() => setIsSmartFetcherOpen(true)}
                              isFocused={focusedPane === 'chat'}
                              onToggleFocus={() => setFocusedPane(focusedPane === 'chat' ? null : 'chat')}
                              onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
                            />
                          </div>
                        </div>
                      </Panel>
                    )}
                  </PanelGroup>
                </Panel>
              )}

              {!focusedPane && <ResizeHandleVertical />}

              {/* Output Panel */}
              {focusedPane !== 'editor' && focusedPane !== 'chat' && (
                <Panel defaultSize={35} minSize={20}>
                  <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-r border-amber-200/50 dark:border-slate-800">
                    <div className="p-3 border-b border-amber-200/50 dark:border-slate-800 font-bold text-[13px] flex items-center justify-between text-amber-900 dark:text-amber-100 bg-amber-50/50 dark:bg-slate-800/50 shadow-sm">
                      <div className="flex items-center gap-2">
                        <Terminal size={16} className="text-amber-600 dark:text-amber-500" /> نافذة البحث والنتائج
                      </div>
                      <div className="flex items-center gap-2">
                        {(output || images.length > 0) && (
                          <button onClick={handleExportResults} className="p-1 text-amber-700/70 dark:text-amber-400/70 hover:text-amber-600 dark:hover:text-amber-300 transition-colors" title="تصدير النتائج">
                            <Save size={16} />
                          </button>
                        )}
                        <button onClick={() => setFocusedPane(focusedPane === 'output' ? null : 'output')} className="p-1 hover:bg-amber-900/10 dark:hover:bg-amber-100/10 rounded text-amber-700/70 dark:text-amber-400/70 hover:text-amber-600 dark:hover:text-amber-300 transition-colors" title="التركيز العميق">
                          {focusedPane === 'output' ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <OutputPane 
                        output={output} 
                        images={images} 
                        currentCode={activeFile.content}
                        onApplyFix={(fixedCode) => updateActiveFileContent(fixedCode)}
                        selectedModel={selectedModel}
                      />
                    </div>
                  </div>
                </Panel>
              )}
            </PanelGroup>
          </div>
        </div>

        {/* Mobile Viewports (< md: breakpoints) */}
        <div className="flex md:hidden flex-1 w-full h-full overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm relative">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/arabesque.png')] opacity-10 pointer-events-none mix-blend-multiply dark:mix-blend-color-burn"></div>
          {activeMobileTab === 'editor' && (
            <div className="w-full h-full flex flex-col bg-slate-900 dark:bg-slate-950 z-10 relative">
              <div className="flex-1 w-full h-full relative" dir="ltr">
                <EditorPane 
                  code={activeFile.content} 
                  onChange={(val) => updateActiveFileContent(val || '')} 
                  fileName={activeFile.name}
                  onOpenSmartFetcher={() => setIsSmartFetcherOpen(true)}
                />
              </div>
            </div>
          )}

          {activeMobileTab === 'chat' && (
            <div className="w-full h-full flex flex-col bg-transparent z-10 relative">
              <div className="p-3 border-b border-amber-200/50 dark:border-amber-900/30 text-[13px] font-bold flex justify-between items-center text-amber-900 dark:text-amber-100 bg-amber-50/50 dark:bg-slate-800/50 shadow-sm">
                <span className="flex items-center gap-2">
                  <MessageSquare size={16} className="text-amber-600 dark:text-amber-500" /> المداد الذكي
                </span>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatPane
                  currentCode={activeFile.content}
                  selectedModel={selectedModel}
                  onUpdateCode={updateActiveFileContent}
                  onRunCode={handleRunCode}
                  output={output}
                  images={images}
                  settings={settings}
                  onUpdateSettings={setSettings}
                  onOpenSmartFetcher={() => setIsSmartFetcherOpen(true)}
                  isFocused={focusedPane === 'chat'}
                  onToggleFocus={() => setFocusedPane(focusedPane === 'chat' ? null : 'chat')}
                  onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
                />
              </div>
            </div>
          )}

          {activeMobileTab === 'output' && (
            <div className="w-full h-full flex flex-col bg-transparent z-10 relative">
              <div className="p-3 border-b border-amber-200/50 dark:border-slate-800 font-bold text-xs flex items-center justify-between text-amber-900 dark:text-amber-100 bg-amber-50/50 dark:bg-slate-800/50 shadow-sm">
                <div className="flex items-center gap-2">
                  <Terminal size={15} className="text-amber-600 dark:text-amber-500" /> نافذة البحث والنتائج
                </div>
                {(output || images.length > 0) && (
                  <button onClick={handleExportResults} className="text-amber-700/70 dark:text-amber-400/70 hover:text-amber-600 dark:hover:text-amber-300" title="تصدير النتائج">
                    <Save size={15} />
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <OutputPane 
                  output={output} 
                  images={images} 
                  currentCode={activeFile.content}
                  onApplyFix={(fixedCode) => updateActiveFileContent(fixedCode)}
                  selectedModel={selectedModel}
                />
              </div>
            </div>
          )}

          {activeMobileTab === 'files' && (
            <div className="w-full h-full flex flex-col bg-slate-50 dark:bg-slate-900">
              <Sidebar
                files={files}
                activeFileId={activeFileId}
                onFileSelect={(id) => {
                  setActiveFileId(id);
                  setActiveMobileTab('editor');
                }}
                onFileAdd={handleAddFile}
                onFileDelete={handleDeleteFile}
                onFileRename={handleRenameFile}
                onFileDuplicate={handleDuplicateFile}
                className="w-full h-full bg-white dark:bg-slate-900 flex flex-col flex-1"
              />
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="h-[30px] bg-amber-700 dark:bg-slate-900 text-amber-50 dark:text-slate-300 border-t border-amber-800 dark:border-slate-800 text-[11px] flex items-center px-4 justify-between shrink-0 font-sans select-none">
        <div className="flex items-center gap-1.5 truncate">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0 shadow-[0_0_5px_rgba(52,211,153,0.8)]"></div>
          <span className="truncate">متصل بخوادم الذكاء الاصطناعي | مداد الرحمن ({availableModels.find(m => m.id === selectedModel)?.name || selectedModel})</span>
        </div>
        <div dir="ltr" className="truncate text-amber-200 dark:text-amber-500 font-bold">{activeFile.name}</div>
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={setSettings}
        selectedModel={selectedModel}
        themeMode={themeMode}
        onThemeChange={setThemeMode}
      />

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onKeyChanged={handleUpdateApiKeyStatus}
        selectedModel={selectedModel}
      />

      {/* Smart Text & API Fetcher Modal */}
      <SmartTextFetcherModal
        isOpen={isSmartFetcherOpen}
        onClose={() => setIsSmartFetcherOpen(false)}
        onInsertCodeToEditor={(code) => updateActiveFileContent(code)}
        onInsertTextToEditor={(text) => updateActiveFileContent(text)}
        onSendToChat={(_promptText) => {
          setActiveMobileTab('chat');
        }}
      />
      {/* Offline Status Indicator */}
      <OfflineIndicator />
    </div>
  );
}


function ResizeHandleVertical() {
  return (
    <PanelResizeHandle className="w-1.5 bg-amber-100/50 dark:bg-slate-800 hover:bg-amber-400 dark:hover:bg-amber-600 transition-colors cursor-col-resize flex flex-col justify-center items-center group">
      <div className="h-8 w-px bg-amber-300 dark:bg-slate-600 rounded-full group-hover:bg-white" />
    </PanelResizeHandle>
  );
}

function ResizeHandleHorizontal() {
  return (
    <PanelResizeHandle className="h-1.5 bg-amber-100/50 dark:bg-slate-800 hover:bg-amber-400 dark:hover:bg-amber-600 transition-colors cursor-row-resize flex flex-row justify-center items-center group">
      <div className="w-8 h-px bg-amber-300 dark:bg-slate-600 rounded-full group-hover:bg-white" />
    </PanelResizeHandle>
  );
}
