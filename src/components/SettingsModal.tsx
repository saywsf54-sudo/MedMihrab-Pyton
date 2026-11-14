import { useState, useEffect } from 'react';
import { 
  X, Sparkles, Sliders, ShieldCheck, Cpu, RefreshCw, Wand2, Zap, RotateCcw, 
  Palette, Key, AlertCircle, Eye, EyeOff, ExternalLink, CheckCircle2 
} from 'lucide-react';
import { Button } from './ui/button';
import { 
  AdvancedSettings, AGENT_PRESETS, DEFAULT_SETTINGS, generateSmartPersona,
  getApiKeyStatus, getCustomApiKey, setCustomApiKey, testApiKeyConnection, ApiKeyStatus 
} from '../services/geminiService';
import ThemeToggle from './ThemeToggle';
import { ThemeMode } from '../hooks/useTheme';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AdvancedSettings;
  onSaveSettings: (newSettings: AdvancedSettings) => void;
  selectedModel: string;
  themeMode?: ThemeMode;
  onThemeChange?: (mode: ThemeMode) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  selectedModel,
  themeMode = 'system',
  onThemeChange
}: SettingsModalProps) {
  const [localSettings, setLocalSettings] = useState<AdvancedSettings>(settings);
  const [activeTab, setActiveTab] = useState<'persona' | 'parameters' | 'tools' | 'apiKey'>('persona');
  const [isGeneratingPersona, setIsGeneratingPersona] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>(getApiKeyStatus());
  const [testingKey, setTestingKey] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setApiKeyInput(getCustomApiKey());
      setApiKeyStatus(getApiKeyStatus());
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApplyPreset = (presetPrompt: string) => {
    setLocalSettings(prev => ({
      ...prev,
      systemPromptOverride: presetPrompt
    }));
  };

  const handleAutoGeneratePersona = async () => {
    setIsGeneratingPersona(true);
    try {
      const generatedPrompt = await generateSmartPersona(localSettings.systemPromptOverride, selectedModel);
      setLocalSettings(prev => ({
        ...prev,
        systemPromptOverride: generatedPrompt
      }));
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingPersona(false);
    }
  };

  const handleSave = () => {
    setCustomApiKey(apiKeyInput);
    onSaveSettings(localSettings);
    onClose();
  };

  const handleResetDefaults = () => {
    setLocalSettings(DEFAULT_SETTINGS);
  };

  const handleTestKey = async () => {
    setTestingKey(true);
    setTestResult(null);
    try {
      const res = await testApiKeyConnection(apiKeyInput.trim() || undefined);
      setTestResult(res);
      setApiKeyStatus(getApiKeyStatus());
    } catch (e: any) {
      setTestResult({ success: false, message: e?.message || 'خطأ أثناء الاختبار' });
    } finally {
      setTestingKey(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/30">
              <Sliders size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                إعدادات التخصيص المتطورة والمظهر
              </h2>
              <p className="text-[12px] text-slate-400">تخصيص كامل للتوجيه، مفتاح API، المظهر، المعايير والبيئة</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Theme Quick Bar */}
        {onThemeChange && (
          <div className="px-6 py-2.5 bg-slate-100 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Palette size={14} className="text-blue-500" />
              مظهر المنصة (Theme Mode):
            </span>
            <ThemeToggle themeMode={themeMode} onThemeChange={onThemeChange} showLabels={true} />
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-6 pt-2 gap-2 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('persona')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'persona' 
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border-blue-600 font-bold shadow-xs' 
                : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Wand2 size={15} />
            تخصيص الخبير والوكيل (Agent Persona)
          </button>
          <button
            onClick={() => setActiveTab('parameters')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'parameters' 
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border-blue-600 font-bold shadow-xs' 
                : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Cpu size={15} />
            معايير التوليد والحرارة (Tuning)
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'tools' 
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border-blue-600 font-bold shadow-xs' 
                : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Zap size={15} />
            الأدوات والمهلة والبيئة
          </button>
          <button
            onClick={() => setActiveTab('apiKey')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'apiKey' 
                ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 border-amber-600 font-bold shadow-xs' 
                : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Key size={15} />
            مفتاح API والاتصال
            <span className={`w-1.5 h-1.5 rounded-full ${apiKeyStatus.source === 'none' ? 'bg-amber-500' : apiKeyStatus.source === 'custom' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-sm text-slate-700 dark:text-slate-200">
          
          {/* TAB 1: PERSONA & AGENT CUSTOMIZATION */}
          {activeTab === 'persona' && (
            <div className="space-y-5">
              
              {/* Ready-made Archetypes */}
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
                  اختر وكيل خبير جاهز (Quick Expert Preset):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {AGENT_PRESETS.map(preset => (
                    <div
                      key={preset.id}
                      onClick={() => handleApplyPreset(preset.systemPrompt)}
                      className="p-3 border rounded-xl cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/40 transition-all bg-white dark:bg-slate-800/80 shadow-xs group border-slate-200 dark:border-slate-700"
                    >
                      <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center justify-between">
                        {preset.title}
                        <span className="text-[10px] text-blue-500 dark:text-blue-400 font-normal group-hover:underline">تطبيق</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        {preset.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Prompt Textarea & Smart Auto-Fill */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-amber-500" />
                    توجيه النظام وتخصيص الوكيل (System Prompt):
                  </label>
                  
                  {/* Smart Generator Button */}
                  <button
                    type="button"
                    onClick={handleAutoGeneratePersona}
                    disabled={isGeneratingPersona}
                    className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-blue-600 hover:from-amber-600 hover:to-blue-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-xs transition-all disabled:opacity-50"
                  >
                    {isGeneratingPersona ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        جاري التوليد والاستنباط الذكي...
                      </>
                    ) : (
                      <>
                        <Wand2 size={13} />
                        توليد استنباطي / ملء تلقائي عبقري ✨
                      </>
                    )}
                  </button>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                  اكتب أي ملاحظات أو كلمات مفتاحية (مثلاً: <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-blue-600 dark:text-blue-400">حساب الجُمل في سورة الكهف</code>) ثم اضغط زر الملأ التلقائي ليستنبط الذكاء الاصطناعي توجيهاً محكماً!
                </p>

                <textarea
                  value={localSettings.systemPromptOverride}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, systemPromptOverride: e.target.value }))}
                  placeholder="أدخل توجيهات الوكيل الخبير هنا أو استخدم زر التوليد الذكي أعلاه..."
                  rows={6}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-mono leading-relaxed focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner"
                />
              </div>

            </div>
          )}

          {/* TAB 2: PARAMETERS & TUNING */}
          {activeTab === 'parameters' && (
            <div className="space-y-6">
              
              {/* Temperature */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-xs text-slate-800 dark:text-slate-200">
                    درجة الحرارة والإبداع (Temperature):
                  </label>
                  <span className="text-xs font-mono font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                    {localSettings.temperature}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={localSettings.temperature}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
                  <span>0.0 (دقيق ومنطقي جداً)</span>
                  <span>0.5 (متوازن)</span>
                  <span>1.0 (إبداعي ومبتكر)</span>
                </div>
              </div>

              {/* Top-P & Top-K */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-xs text-slate-800 dark:text-slate-200">Top-P (Nucleus Sampling):</label>
                    <span className="text-xs font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded-md">
                      {localSettings.topP}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={localSettings.topP}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, topP: parseFloat(e.target.value) }))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-xs text-slate-800 dark:text-slate-200">Top-K (Candidate Pool):</label>
                    <span className="text-xs font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded-md">
                      {localSettings.topK}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    value={localSettings.topK}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, topK: parseInt(e.target.value) }))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Max Output Tokens */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                <label className="block font-bold text-xs text-slate-800 dark:text-slate-200">
                  حد المخرجات الأقصى (Max Output Tokens):
                </label>
                <select
                  value={localSettings.maxOutputTokens}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, maxOutputTokens: parseInt(e.target.value) }))}
                  className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-500 outline-none"
                >
                  <option value={4096}>4,096 طوكن (مخرجات طويلة)</option>
                  <option value={8192}>8,192 طوكن (مخرجات ضخمة وأكواد طويلة)</option>
                  <option value={16384}>16,384 طوكن (مخرجات فائقة الطول)</option>
                  <option value={32768}>32,768 طوكن (مخرجات غير محدودة تقريباً)</option>
                  <option value={65536}>65,536 طوكن (أقصى سعة نموذج بدون أي قيود - افتراضي ✨)</option>
                </select>
              </div>

            </div>
          )}

          {/* TAB 3: TOOLS & ENVIRONMENT */}
          {activeTab === 'tools' && (
            <div className="space-y-5">
              
              {/* Toggle Google Search */}
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">البحث الحاد المباشر عبر Google Search:</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">يتيح للنموذج الوصول لأحدث المعلومات والبيانات من الويب تلقائياً.</p>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.enableGoogleSearch}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, enableGoogleSearch: e.target.checked }))}
                  className="w-5 h-5 accent-blue-600 cursor-pointer rounded"
                />
              </div>

              {/* Toggle Editor Tools */}
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">تفعيل أدوات التحكم بالمحرر (Code Editor Tools):</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">السماح للنموذج بتحديث كود المحرر بـ update_editor_code وتشغيل البرامج تلقائياً.</p>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.enableEditorTools}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, enableEditorTools: e.target.checked }))}
                  className="w-5 h-5 accent-blue-600 cursor-pointer rounded"
                />
              </div>

              {/* Timeout for Python Execution */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                <label className="block font-bold text-xs text-slate-800 dark:text-slate-200">
                  مهلة تنفيذ كود بايثون (Python Sandbox Timeout):
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[15, 30, 45, 60].map(sec => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setLocalSettings(prev => ({ ...prev, executionTimeoutSeconds: sec }))}
                      className={`py-2 text-xs font-bold font-mono rounded-lg border transition-all ${
                        localSettings.executionTimeoutSeconds === sec 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                      }`}
                    >
                      {sec} ثانية
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: API KEY & CONNECTION */}
          {activeTab === 'apiKey' && (
            <div className="space-y-5">
              
              {/* Status Box */}
              <div className={`p-4 rounded-xl border flex items-start gap-3.5 ${
                apiKeyStatus.source === 'custom'
                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60'
                  : apiKeyStatus.source === 'env'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60'
                  : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60'
              }`}>
                <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                  apiKeyStatus.source === 'custom'
                    ? 'bg-blue-500 text-white'
                    : apiKeyStatus.source === 'env'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-amber-500 text-white'
                }`}>
                  {apiKeyStatus.source === 'none' ? <AlertCircle size={18} /> : <ShieldCheck size={18} />}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                      حالة المفتاح الحالي (API Key Status):
                    </span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      apiKeyStatus.source === 'custom'
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                        : apiKeyStatus.source === 'env'
                        ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
                    }`}>
                      {apiKeyStatus.source === 'custom' && 'مفتاح مخصص قيد الاستخدام'}
                      {apiKeyStatus.source === 'env' && 'المفتاح المدمج في البيئة نشط (Internal Env Key)'}
                      {apiKeyStatus.source === 'none' && 'لم يتم العثور على مفتاح'}
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    {apiKeyStatus.source === 'custom' && (
                      <>يعمل النظام حالياً بمفتاحك الشخصي: <code className="font-mono bg-blue-100/70 dark:bg-blue-900/50 px-1 py-0.5 rounded text-[11px]">{apiKeyStatus.maskedKey}</code></>
                    )}
                    {apiKeyStatus.source === 'env' && (
                      <>يعمل النظام بالمفتاح الداخلي المدمج في بيئة العمل: <code className="font-mono bg-emerald-100/70 dark:bg-emerald-900/50 px-1 py-0.5 rounded text-[11px]">{apiKeyStatus.maskedKey}</code></>
                    )}
                    {apiKeyStatus.source === 'none' && (
                      'لم يتم اكتشاف مفتاح بيئة داخلي. أدخل مفتاحك الشخصي أدناه لتشغيل كافة ميزات المنصة.'
                    )}
                  </p>
                </div>
              </div>

              {/* Input */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  إدخال مفتاح مخصص (Custom Gemini API Key):
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full text-xs font-mono px-3.5 py-2.5 pr-10 pl-24 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                    dir="ltr"
                  />
                  <div className="absolute right-3 text-slate-400">
                    <Key size={15} />
                  </div>
                  <div className="absolute left-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition-colors"
                      title={showKey ? 'إخفاء' : 'إظهار'}
                    >
                      {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    {apiKeyInput && (
                      <button
                        type="button"
                        onClick={() => setApiKeyInput('')}
                        className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors"
                        title="مسح الحقل"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  اترك الحقل فارغاً لاستخدام المفتاح الداخلي المدمج تلقائياً دون الحاجة لإدخال مفتاحك.
                </p>
              </div>

              {/* Action & Test */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={handleTestKey}
                    disabled={testingKey}
                    variant="outline"
                    className="text-xs h-9 px-3 flex items-center gap-1.5 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    <RefreshCw size={13} className={testingKey ? 'animate-spin text-amber-600' : ''} />
                    <span>{testingKey ? 'جاري فحص الاتصال...' : 'اختبار اتصال المفتاح الآن'}</span>
                  </Button>

                  {getCustomApiKey() && (
                    <Button
                      type="button"
                      onClick={() => {
                        setApiKeyInput('');
                        setCustomApiKey('');
                        setApiKeyStatus(getApiKeyStatus());
                        setTestResult(null);
                      }}
                      variant="outline"
                      className="text-xs h-9 px-3 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      العودة للمفتاح المدمج
                    </Button>
                  )}
                </div>

                {testResult && (
                  <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-in fade-in ${
                    testResult.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                      : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                  }`}>
                    {testResult.success ? (
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span className="leading-relaxed">{testResult.message}</span>
                  </div>
                )}
              </div>

              {/* Get Key Link */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 text-[12px] space-y-1">
                <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>الحصول على مفتاح إضافي:</span>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 text-[11px]"
                  >
                    <span>Google AI Studio</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                  يمكنك الحصول على مفتاح مجاني بدون بطاقة ائتمانية من منصة Google AI Studio واستخدامه لرفع كفاءة وسرعة المعالجة.
                </p>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <Button
            type="button"
            onClick={handleResetDefaults}
            variant="outline"
            className="text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs flex items-center gap-1.5"
          >
            <RotateCcw size={14} />
            إعادة الضبط للافتراضي
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="text-xs dark:border-slate-700 dark:text-slate-300"
            >
              إلغاء
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 flex items-center gap-1.5"
            >
              <ShieldCheck size={15} />
              حفظ وتطبيق التغييرات
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
