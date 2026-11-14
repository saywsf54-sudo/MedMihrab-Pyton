import { Sun, Moon, Laptop } from 'lucide-react';
import { ThemeMode } from '../hooks/useTheme';

interface ThemeToggleProps {
  themeMode: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
  className?: string;
  showLabels?: boolean;
}

export default function ThemeToggle({
  themeMode,
  onThemeChange,
  className = "",
  showLabels = false
}: ThemeToggleProps) {
  return (
    <div
      className={`inline-flex items-center bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 p-0.5 rounded-lg shadow-2xs transition-all select-none ${className}`}
      dir="rtl"
    >
      <button
        type="button"
        onClick={() => onThemeChange('light')}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
          themeMode === 'light'
            ? 'bg-white text-amber-600 shadow-2xs font-bold'
            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
        }`}
        title="الوضع الفاتح (Light Mode)"
      >
        <Sun size={13} className={themeMode === 'light' ? 'text-amber-500 fill-amber-400' : ''} />
        {showLabels && <span>فاتح</span>}
      </button>

      <button
        type="button"
        onClick={() => onThemeChange('dark')}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
          themeMode === 'dark'
            ? 'bg-slate-900 text-blue-400 shadow-2xs font-bold border border-slate-700'
            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
        }`}
        title="الوضع الداكن (Dark Mode)"
      >
        <Moon size={13} className={themeMode === 'dark' ? 'text-blue-400 fill-blue-400/20' : ''} />
        {showLabels && <span>داكن</span>}
      </button>

      <button
        type="button"
        onClick={() => onThemeChange('system')}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
          themeMode === 'system'
            ? 'bg-blue-600 text-white shadow-2xs font-bold'
            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
        }`}
        title="تلقائي بحسب نظام الجهاز (System Auto)"
      >
        <Laptop size={13} />
        {showLabels && <span>تلقائي</span>}
      </button>
    </div>
  );
}
