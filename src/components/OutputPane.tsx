import { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { markdownRehypePlugins } from '../lib/rehypeFixDomProps';
import { PreBlock, CodeBlock } from './MarkdownCodeBlocks';
import { 
  Copy, Check, Download, Maximize2, X, Terminal, Image as ImageIcon, 
  Sparkles, Bug, AlertTriangle, CheckCircle2, RefreshCw, Code2, Wrench, Lightbulb
} from 'lucide-react';
import { explainAndFixCodeError, DebugAnalysisResult } from '../services/geminiService';
import { copyToClipboard } from '../lib/utils';

const OutputCodeBlock = (props: any) => <CodeBlock {...props} inlineTone="amber" />;

interface OutputPaneProps {
  output: string;
  images?: string[];
  executionTimeMs?: number | null;
  currentCode?: string;
  onApplyFix?: (fixedCode: string) => void;
  selectedModel?: string;
}

export default function OutputPane({ 
  output, 
  images = [], 
  executionTimeMs,
  currentCode = '',
  onApplyFix,
  selectedModel = 'gemini-4-hydrogen'
}: OutputPaneProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'console' | 'images' | 'debug'>('all');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Debug State
  const [debugResult, setDebugResult] = useState<DebugAnalysisResult | null>(null);
  const [isAnalyzingDebug, setIsAnalyzingDebug] = useState(false);
  const [appliedFixSuccess, setAppliedFixSuccess] = useState(false);

  // Detect if output contains a python error or execution failure
  const isErrorOutcome = useMemo(() => {
    if (!output) return false;
    return (
      output.includes('OUTCOME_FAILED') ||
      output.includes('Traceback (most recent call last)') ||
      output.includes('خطأ في التنفيذ') ||
      output.includes('SyntaxError:') ||
      output.includes('NameError:') ||
      output.includes('TypeError:') ||
      output.includes('IndexError:') ||
      output.includes('KeyError:') ||
      output.includes('ZeroDivisionError:') ||
      output.includes('ImportError:') ||
      output.includes('AttributeError:') ||
      output.includes('ValueError:')
    );
  }, [output]);

  const handleCopyOutput = async () => {
    if (!output) return;
    const ok = await copyToClipboard(output);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadImage = (imgUrl: string, index: number) => {
    const link = document.createElement('a');
    link.href = imgUrl;
    link.download = `visualization_chart_${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRunDebugAnalysis = async () => {
    if (isAnalyzingDebug) return;
    setIsAnalyzingDebug(true);
    setAppliedFixSuccess(false);
    try {
      const res = await explainAndFixCodeError(currentCode, output, selectedModel);
      setDebugResult(res);
    } catch (err) {
      console.error("Debug analysis failed:", err);
    } finally {
      setIsAnalyzingDebug(false);
    }
  };

  const handleApplyFixedCode = () => {
    if (debugResult && debugResult.fixedCode && onApplyFix) {
      onApplyFix(debugResult.fixedCode);
      setAppliedFixSuccess(true);
      setTimeout(() => setAppliedFixSuccess(false), 4000);
    }
  };

  if (!output && (!images || images.length === 0)) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 font-sans text-xs bg-slate-50 dark:bg-slate-900/60 p-6 text-center select-none">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-slate-800 flex items-center justify-center text-blue-500 mb-3 shadow-2xs border border-blue-100 dark:border-slate-700">
          <Terminal size={24} />
        </div>
        <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300 mb-1">جاهز لتنفيذ الأكواد والبرامج</h3>
        <p className="text-[12px] text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
          اضغط زر <span className="font-bold text-emerald-600 dark:text-emerald-400">"تشغيل الكود"</span> لتنفيذ السكريبت وإظهار المخرجات والرسومات البيانية التفاعلية هنا.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#f8f9fa] dark:bg-slate-950 text-[#1e293b] dark:text-slate-100" dir="rtl">
      {/* Output Header Controls */}
      <div className="h-9 border-b border-[#e2e8f0] dark:border-slate-800 bg-white dark:bg-slate-900 px-3 flex items-center justify-between shrink-0 text-xs select-none">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-2.5 py-1 rounded-md transition-colors text-[11px] font-semibold whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            الكل ({output ? 1 : 0} نص، {images.length} صورة)
          </button>
          
          {output && (
            <button
              onClick={() => setActiveTab('console')}
              className={`px-2.5 py-1 rounded-md transition-colors text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap ${
                activeTab === 'console'
                  ? 'bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Terminal size={12} />
              النصوص
            </button>
          )}

          {images.length > 0 && (
            <button
              onClick={() => setActiveTab('images')}
              className={`px-2.5 py-1 rounded-md transition-colors text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap ${
                activeTab === 'images'
                  ? 'bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <ImageIcon size={12} />
              الرسومات ({images.length})
            </button>
          )}

          {/* Smart Debug Tab (Highlighted if Error) */}
          {(isErrorOutcome || debugResult) && (
            <button
              onClick={() => {
                setActiveTab('debug');
                if (!debugResult && !isAnalyzingDebug) {
                  handleRunDebugAnalysis();
                }
              }}
              className={`px-2.5 py-1 rounded-md transition-all text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'debug'
                  ? 'bg-rose-500 text-white shadow-2xs'
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 animate-pulse'
              }`}
            >
              <Bug size={13} />
              <span>تصحيح الأخطاء الذكي (Debug)</span>
            </button>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {executionTimeMs !== undefined && executionTimeMs !== null && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono hidden sm:inline">
              الزمن: {executionTimeMs}ms
            </span>
          )}

          {output && (
            <button
              onClick={handleCopyOutput}
              className="flex items-center gap-1 px-2 py-1 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors text-[11px]"
              title="نسخ مخرجات النص"
            >
              {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              <span>{copied ? 'تم النسخ' : 'نسخ'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Output Scrollable Content */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">

        {/* Prominent Error Banner if an Error is detected and user is on 'all' or 'console' */}
        {isErrorOutcome && activeTab !== 'debug' && (
          <div className="bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent border border-rose-300 dark:border-rose-900/80 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-800 dark:text-rose-200 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-rose-500 text-white rounded-lg shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h4 className="font-bold text-xs">تم اكتشاف خطأ برمي أثناء التشغيل</h4>
                <p className="text-[11px] opacity-80 mt-0.5">
                  يمكن لـ Gemini تحليل المشكلة البرمجية وشرح سببها واقتراح الحل تلقائياً.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setActiveTab('debug');
                if (!debugResult && !isAnalyzingDebug) {
                  handleRunDebugAnalysis();
                }
              }}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-lg flex items-center gap-1.5 transition-colors shrink-0 shadow-2xs"
            >
              <Sparkles size={13} />
              تشخيص ومعالجة الخطأ بـ Debug
            </button>
          </div>
        )}
        
        {/* Debug Tab View */}
        {activeTab === 'debug' && (
          <div className="space-y-4">
            {/* Header Card */}
            <div className="border border-rose-200 dark:border-rose-900/70 rounded-xl p-4 bg-white dark:bg-slate-900 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 rounded-lg">
                    <Wrench size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">لوحة تشخيص وتنقيب الأخطاء (Smart Debugger)</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">تحليل كود بايثون البرمجي بواسطة Gemini واقتراح الإصلاحات الفورية</p>
                  </div>
                </div>

                <button
                  onClick={handleRunDebugAnalysis}
                  disabled={isAnalyzingDebug}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={13} className={isAnalyzingDebug ? "animate-spin text-blue-500" : ""} />
                  إعادة التشخيص
                </button>
              </div>

              {/* Status or Analysis Progress */}
              {isAnalyzingDebug && (
                <div className="p-6 text-center text-slate-500 dark:text-slate-400 space-y-2">
                  <Sparkles size={24} className="animate-spin text-blue-500 mx-auto" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">جاري قراءة كود بايثون وتحليل الخطأ عبر Gemini...</p>
                  <p className="text-[11px] text-slate-400">سيتم استخراج نوع الخطأ وصياغة حل هندسي مبسط فوراً.</p>
                </div>
              )}

              {/* Debug Diagnosis Content */}
              {!isAnalyzingDebug && debugResult && (
                <div className="space-y-4">
                  {/* Applied Fix Toast Alert */}
                  {appliedFixSuccess && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                      <span>تم تطبيق الكود المصحح على محرر السكريبتات بنجاح! يمكنك إعادة التشغيل الآن.</span>
                    </div>
                  )}

                  {/* 1. Error Summary Box */}
                  <div className="p-3 bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl">
                    <span className="text-[10px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wider block mb-1">نوع وملخص المشكلة</span>
                    <h4 className="font-bold text-sm text-rose-900 dark:text-rose-200">{debugResult.errorSummary}</h4>
                  </div>

                  {/* 2. Simplified Explanation */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                      <Lightbulb size={14} className="text-amber-500" />
                      تفسير الخطأ بأسلوب مبسط:
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                      {debugResult.explanation}
                    </p>
                  </div>

                  {/* 3. Recommended Fixing Steps */}
                  {debugResult.suggestions && debugResult.suggestions.length > 0 && (
                    <div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">خطوات المعالجة المقترحة:</span>
                      <ul className="space-y-1.5">
                        {debugResult.suggestions.map((sug, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                            <span className="w-5 h-5 rounded-full bg-blue-50 dark:bg-slate-700 text-blue-600 dark:text-blue-400 font-bold text-[10px] flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="leading-snug">{sug}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 4. Corrected Code Block & Direct Apply Button */}
                  {debugResult.fixedCode && (
                    <div className="mt-4 border border-emerald-200 dark:border-emerald-900/80 rounded-xl overflow-hidden bg-slate-900">
                      <div className="bg-slate-800 px-3 py-2 border-b border-slate-700 flex items-center justify-between text-xs font-bold text-slate-200">
                        <span className="flex items-center gap-1.5 text-emerald-400">
                          <Code2 size={14} />
                          الكود المصحح الجاهز (Corrected Python Code)
                        </span>
                        
                        {onApplyFix && (
                          <button
                            onClick={handleApplyFixedCode}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors shadow-2xs"
                          >
                            <CheckCircle2 size={13} />
                            تطبيق الإصلاح على المحرر
                          </button>
                        )}
                      </div>

                      <div className="p-3 font-mono text-xs text-emerald-300 overflow-x-auto max-h-[300px] leading-relaxed" dir="ltr">
                        <pre>{debugResult.fixedCode}</pre>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* Fallback Trigger Button if not analyzed yet */}
              {!isAnalyzingDebug && !debugResult && (
                <div className="p-6 text-center space-y-3">
                  <Bug size={32} className="text-rose-400 mx-auto animate-bounce" />
                  <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
                    انقر فوق الزر أدناه ليقوم نموذج Gemini بقراءة الخطأ المذكور في سجل التنفيذ وكتابة الحل المناسب فوراً.
                  </p>
                  <button
                    onClick={handleRunDebugAnalysis}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-md transition-all"
                  >
                    <Sparkles size={15} />
                    بدء التحليل والتصحيح الآلي بـ Gemini
                  </button>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Text Output Block */}
        {output && (activeTab === 'all' || activeTab === 'console') && (
          <div className="border border-[#e2e8f0] dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 shadow-xs">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Terminal size={14} className="text-emerald-500" />
                سجل المخرجات والتنفيذ (Execution Output)
              </span>
            </div>
            <div className="markdown-body prose prose-slate dark:prose-invert prose-sm max-w-none text-right font-sans leading-relaxed" dir="rtl">
              <ReactMarkdown 
                rehypePlugins={markdownRehypePlugins}
                components={{
                  code: OutputCodeBlock,
                  pre: PreBlock,
                }}
              >
                {output}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Generated Charts Block */}
        {images && images.length > 0 && (activeTab === 'all' || activeTab === 'images') && (
          <div className="space-y-4">
            {images.map((img, i) => (
              <div key={i} className="border border-[#e2e8f0] dark:border-slate-800 rounded-xl p-3 bg-white dark:bg-slate-900 shadow-xs">
                <div className="flex items-center justify-between mb-2 text-xs font-bold text-slate-800 dark:text-slate-200 px-1">
                  <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                    <ImageIcon size={14} />
                    رسم بياني توضيحي #{i + 1}
                  </span>
                  
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedImage(img)}
                      className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded transition-colors"
                      title="تكبير الرسم البياني"
                    >
                      <Maximize2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDownloadImage(img, i)}
                      className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded transition-colors"
                      title="تحميل الصورة"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                </div>

                <div 
                  className="relative group cursor-pointer overflow-hidden rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-950/5 flex items-center justify-center"
                  onClick={() => setSelectedImage(img)}
                >
                  <img 
                    src={img} 
                    alt={`Generated Visualization ${i + 1}`} 
                    className="w-full h-auto max-h-[450px] object-contain transition-transform duration-200 group-hover:scale-[1.01]" 
                  />
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5 backdrop-blur-[1px]">
                    <Maximize2 size={16} />
                    انقر للتكبير والمعاينة الشاملة
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Fullscreen Image Preview Lightbox Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedImage(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl p-2 shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 flex items-center justify-between text-white text-xs border-b border-slate-800 font-bold">
              <span>معاينة الرسم البياني عالية الدقة</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadImage(selectedImage, 0)}
                  className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1 text-[11px]"
                >
                  <Download size={13} />
                  تحميل
                </button>
                <button
                  onClick={() => setSelectedImage(null)}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-4 flex-1 flex items-center justify-center overflow-auto">
              <img 
                src={selectedImage} 
                alt="Full visualization view" 
                className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
