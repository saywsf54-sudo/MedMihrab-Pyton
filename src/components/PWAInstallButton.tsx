import React, { useState } from 'react';
import { Download, Smartphone, Share2, Check, X, Sparkles, Monitor, ExternalLink } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Button } from './ui/button';

interface PWAInstallButtonProps {
  variant?: 'header' | 'menu' | 'banner';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'header', className = '' }) => {
  const { isInstallable, isInstalled, isInIframe, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  // If already installed and running standalone, hide or show subtle indicator
  if (isInstalled && variant === 'header') {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      // Show guided instructions for browser menu (3 dots) / iOS
      setShowGuideModal(true);
    }
  };

  return (
    <>
      <button
        onClick={handleInstallClick}
        className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all shadow-2xs shrink-0 ${
          isInstalled
            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
            : 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white shadow-amber-900/20 hover:shadow-sm'
        } ${className}`}
        title={isInstalled ? "المنصة مثبتة وتعمل كتطبيق أصيل" : "تثبيت المنصة كتطبيق ويب تقدمي (PWA)"}
      >
        {isInstalled ? (
          <>
            <Check size={13} className="text-emerald-600 dark:text-emerald-400" />
            <span className="hidden xs:inline">مثبت</span>
          </>
        ) : (
          <>
            <Download size={13} className="animate-bounce" />
            <span>تثبيت التطبيق</span>
            <span className="hidden md:inline-block text-[9px] bg-amber-800/60 px-1 py-0.2 rounded text-amber-200">
              PWA
            </span>
          </>
        )}
      </button>

      {/* Guided Install Modal for 3-dots / iOS / Desktop */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-amber-200/60 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-amber-900 via-slate-900 to-amber-950 text-white flex items-center justify-between border-b border-amber-800/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30">
                  <Smartphone size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    تثبيت محراب القرآن (PWA)
                  </h3>
                  <p className="text-[11px] text-amber-200/70">تجربة تطبيق مستقل وسريع بدون شريط المتصفح</p>
                </div>
              </div>
              <button 
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs text-slate-700 dark:text-slate-200">
              
              {isInstallable && (
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300">
                    <Sparkles size={16} />
                    <span>جاهز للتثبيت الفوري بنقرة واحدة!</span>
                  </div>
                  <Button
                    onClick={async () => {
                      setShowGuideModal(false);
                      await install();
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 h-auto rounded-lg shadow-sm"
                  >
                    تثبيت على جهازك الآن
                  </Button>
                </div>
              )}

              {isInIframe && (
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                    <ExternalLink size={16} className="text-amber-600" />
                    <span>للتثبيت من قائمة الـ 3 نقاط (⋮):</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    المتصفحات (مثل Google Chrome و Edge) تمنع تثبيت تطبيقات الويب من داخل إطار المعاينة الداخلي، وتتطلب فتح المنصة في تبويب كامل مستقل لتظهر أيقونة التثبيت في شريط المتصفح وقائمة الثلاث نقاط.
                  </p>
                  <a
                    href={typeof window !== 'undefined' ? window.location.href : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2 px-3 rounded-lg shadow-sm transition-colors text-center"
                  >
                    <ExternalLink size={14} />
                    <span>فتح في تبويب متصفح مستقل للتثبيت</span>
                  </a>
                </div>
              )}

              {/* Instructions for Chromium 3 Dots Menu */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Monitor size={15} className="text-amber-600" />
                  من خلال المتصفح (Chrome / Edge / الهاتف):
                </h4>

                <div className="space-y-2 pr-2 border-r-2 border-amber-400/60 text-slate-600 dark:text-slate-300 text-[12px] leading-relaxed">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
                    <span>اضغط على <strong>قائمة المتصفح (الثلاث نقاط ⋮)</strong> في أعلى يمين أو يسار شاشتك.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
                    <span>اختر <strong>«تثبيت التطبيق» (Install app)</strong> أو <strong>«إضافة إلى الشاشة الرئيسية»</strong>.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold flex items-center justify-center shrink-0 text-[11px]">3</span>
                    <span>أكّد التثبيت لفتح المنصة مباشرة كبرنامج مخصص يعمل بكفاءة وأداء مضاعف.</span>
                  </div>
                </div>
              </div>

              {/* iOS Safari Guide */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 text-[12px]">
                  <Share2 size={14} className="text-blue-500" />
                  لمستخدمي آيفون وآيباد (Safari):
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  اضغط على أيقونة <strong>المشاركة (Share)</strong> في أسفل متصفح Safari، ثم اختر <strong>«إضافة إلى الصفحة الرئيسية» (Add to Home Screen)</strong>.
                </p>
              </div>

              {/* Features of PWA */}
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                <div className="flex items-center gap-1.5">
                  <Check size={13} className="text-emerald-500 shrink-0" />
                  <span>فتح فوري وبدون شريط عنوان</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check size={13} className="text-emerald-500 shrink-0" />
                  <span>دعم كامل للعمل بدون إنترنت</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check size={13} className="text-emerald-500 shrink-0" />
                  <span>أيقونة خاصة على سطح المكتب</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check size={13} className="text-emerald-500 shrink-0" />
                  <span>حفظ الذاكرة والبيانات محلياً</span>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <Button
                onClick={() => setShowGuideModal(false)}
                className="bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs px-4 py-2 h-auto"
              >
                حسناً، فهمت
              </Button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
