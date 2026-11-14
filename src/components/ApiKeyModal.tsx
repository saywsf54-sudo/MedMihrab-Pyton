import { useState, useEffect } from 'react';
import { 
  Key, ShieldCheck, AlertCircle, RefreshCw, Eye, EyeOff, 
  ExternalLink, Trash2, X, CheckCircle2 
} from 'lucide-react';
import { Button } from './ui/button';
import { 
  getApiKeyStatus, 
  getCustomApiKey, 
  setCustomApiKey, 
  testApiKeyConnection, 
  ApiKeyStatus 
} from '../services/geminiService';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyChanged?: () => void;
  selectedModel?: string;
}

export default function ApiKeyModal({ isOpen, onClose, onKeyChanged, selectedModel }: ApiKeyModalProps) {
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [status, setStatus] = useState<ApiKeyStatus>(getApiKeyStatus());
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [savedSuccessMessage, setSavedSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const current = getApiKeyStatus();
      setStatus(current);
      setApiKeyInput(getCustomApiKey());
      setTestResult(null);
      setSavedSuccessMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    setCustomApiKey(apiKeyInput);
    const updatedStatus = getApiKeyStatus();
    setStatus(updatedStatus);
    setSavedSuccessMessage(
      apiKeyInput.trim()
        ? 'تم حفظ وتفعيل المفتاح المخصص بنجاح!'
        : 'تم تفعيل المفتاح المدمج في بيئة العمل الافتراضية بنجاح!'
    );
    setTestResult(null);
    if (onKeyChanged) onKeyChanged();
    setTimeout(() => {
      setSavedSuccessMessage(null);
    }, 3000);
  };

  const handleClear = () => {
    setApiKeyInput('');
    setCustomApiKey('');
    const updatedStatus = getApiKeyStatus();
    setStatus(updatedStatus);
    setSavedSuccessMessage('تمت العودة للمفتاح المدمج الافتراضي بنجاح.');
    setTestResult(null);
    if (onKeyChanged) onKeyChanged();
    setTimeout(() => {
      setSavedSuccessMessage(null);
    }, 3000);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const keyToTest = apiKeyInput.trim() || undefined;
      const res = await testApiKeyConnection(keyToTest, selectedModel);
      setTestResult(res);
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e?.message || 'تعذر إتمام اختبار الاتصال بالمفتاح.'
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-900 via-slate-900 to-amber-950 text-white flex items-center justify-between border-b border-amber-800/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30">
              <Key size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                إدارة مفتاح Google Gemini API
              </h2>
              <p className="text-[12px] text-amber-200/70">المفتاح الداخلي المدمج أو مفتاحك المخصص</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm text-slate-700 dark:text-slate-200">
          
          {/* Status Badge Box */}
          <div className={`p-4 rounded-xl border flex items-start gap-3.5 ${
            status.source === 'custom'
              ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60'
              : status.source === 'env'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60'
              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60'
          }`}>
            <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
              status.source === 'custom'
                ? 'bg-blue-500 text-white'
                : status.source === 'env'
                ? 'bg-emerald-600 text-white'
                : 'bg-amber-500 text-white'
            }`}>
              {status.source === 'none' ? <AlertCircle size={18} /> : <ShieldCheck size={18} />}
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                  الحالة الحالية لمفتاح API:
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  status.source === 'custom'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : status.source === 'env'
                    ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
                }`}>
                  {status.source === 'custom' && 'مفتاح مخصص قيد الاستخدام'}
                  {status.source === 'env' && 'المفتاح المدمج في البيئة نشط (Internal Env Key)'}
                  {status.source === 'none' && 'لم يتم العثور على مفتاح'}
                </span>
              </div>
              <p className="text-[12px] text-slate-600 dark:text-slate-400 leading-relaxed">
                {status.source === 'custom' && (
                  <>يعمل النظام حالياً بمفتاحك الشخصي المخصص: <code className="font-mono bg-blue-100/70 dark:bg-blue-900/50 px-1 py-0.5 rounded text-[11px]">{status.maskedKey}</code></>
                )}
                {status.source === 'env' && (
                  <>يعمل النظام تلقائياً بالمفتاح الداخلي المدمج الموفر من بيئة العمل: <code className="font-mono bg-emerald-100/70 dark:bg-emerald-900/50 px-1 py-0.5 rounded text-[11px]">{status.maskedKey}</code></>
                )}
                {status.source === 'none' && (
                  'لم يتم اكتشاف مفتاح بيئة داخلي. يرجى إدخال مفتاحك الشخصي أدناه لتتمكن من استخدام المنصة.'
                )}
              </p>
            </div>
          </div>

          {/* Success Banner */}
          {savedSuccessMessage && (
            <div className="p-3 bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span className="font-semibold">{savedSuccessMessage}</span>
            </div>
          )}

          {/* Key Input Section */}
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

          {/* Test Connection Button & Result */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={handleTest}
                disabled={testing}
                variant="outline"
                className="text-xs h-9 px-3 flex items-center gap-1.5 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <RefreshCw size={13} className={testing ? 'animate-spin text-amber-600' : ''} />
                <span>{testing ? 'جاري فحص الاتصال بالمفتاح...' : 'اختبار اتصال المفتاح الآن'}</span>
              </Button>

              {getCustomApiKey() && (
                <Button
                  type="button"
                  onClick={handleClear}
                  variant="outline"
                  className="text-xs h-9 px-3 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-1"
                >
                  <Trash2 size={13} />
                  <span>حذف المفتاح المخصص</span>
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

          {/* How to get a key */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 text-[12px] space-y-1.5">
            <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span>كيف أحصل على مفتاح مجاني؟</span>
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
              يمكنك الحصول على مفتاح API مجاني وسريع من Google AI Studio عبر حسابك في جوجل، ولصقه هنا لزيادة حدود الاستخدام ورفع القيود.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <Button
            type="button"
            onClick={onClose}
            variant="outline"
            className="text-xs dark:border-slate-700 dark:text-slate-300"
          >
            إغلاق
          </Button>

          <Button
            type="button"
            onClick={handleSave}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 flex items-center gap-1.5 shadow-sm"
          >
            <ShieldCheck size={15} />
            <span>حفظ وتفعيل</span>
          </Button>
        </div>

      </div>
    </div>
  );
}
