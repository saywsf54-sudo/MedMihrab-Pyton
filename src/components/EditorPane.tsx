import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Copy, Check, Trash2, FileCode, Database, Maximize2, Minimize2 } from 'lucide-react';
import { CODE_SNIPPETS } from '../data/codeSnippets';
import { copyToClipboard } from '../lib/utils';

interface EditorPaneProps {
  code: string;
  onChange: (value: string | undefined) => void;
  fileName?: string;
  onOpenSmartFetcher?: () => void;
  isFocused?: boolean;
  onToggleFocus?: () => void;
}

export default function EditorPane({ code, onChange, fileName = 'script.py', onOpenSmartFetcher, isFocused, onToggleFocus }: EditorPaneProps) {
  const [copied, setCopied] = useState(false);
  const [selectedSnippetId, setSelectedSnippetId] = useState<string>('');
  const [scrollProgress, setScrollProgress] = useState(0);

  const handleEditorDidMount = (editor: any) => {
    // Restore saved scroll position for this file
    const savedScroll = localStorage.getItem(`scroll_pos_${fileName}`);
    if (savedScroll) {
      setTimeout(() => {
        editor.setScrollTop(parseInt(savedScroll, 10));
      }, 100);
    }

    // Track scroll progress
    editor.onDidScrollChange((e: any) => {
      const scrollTop = e.scrollTop;
      const scrollHeight = e.scrollHeight;
      const clientHeight = editor.getLayoutInfo().height;
      
      let progress = 0;
      if (scrollHeight > clientHeight) {
        progress = Math.min(100, Math.max(0, (scrollTop / (scrollHeight - clientHeight)) * 100));
      } else {
        progress = 100;
      }
      
      setScrollProgress(progress);
      localStorage.setItem(`scroll_pos_${fileName}`, scrollTop.toString());
    });
  };

  const handleCopyCode = async () => {
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClearCode = () => {
    if (window.confirm('هل أنت تأكد من رغبتك في مسح كود المحرر؟')) {
      onChange('');
    }
  };

  const handleInsertSnippet = (snippetId: string) => {
    if (!snippetId) return;
    const snippet = CODE_SNIPPETS.find(s => s.id === snippetId);
    if (snippet) {
      if (!code.trim() || window.confirm('سيتم استبدال الكود الحالي بالنموذج المختار، هل ترغب في المتابعة؟')) {
        onChange(snippet.code);
      }
    }
    setSelectedSnippetId('');
  };

  const lineCount = code ? code.split('\n').length : 0;
  const charCount = code ? code.length : 0;

  return (
    <div className="h-full flex flex-col bg-[#111827]">
      {/* Editor Sub-Header Toolbar */}
      <div className="h-9 bg-[#1e293b] border-b border-slate-800 px-2 sm:px-3 flex items-center justify-between text-slate-300 shrink-0 select-none text-xs gap-1.5 overflow-x-auto scrollbar-none" dir="rtl">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="flex items-center gap-1 font-mono text-emerald-400 font-bold bg-slate-900 px-1.5 sm:px-2 py-0.5 rounded border border-slate-700/80 text-[10px] sm:text-[11px] max-w-[110px] sm:max-w-[160px] truncate">
            <FileCode size={12} className="text-emerald-400 shrink-0" />
            <span className="truncate">{fileName}</span>
          </span>
          <span className="text-[10px] text-slate-400 hidden lg:inline">
            ({lineCount} سطر • {charCount} حرف)
          </span>
        </div>

        {/* Toolbar Quick Actions */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {onOpenSmartFetcher && (
            <button
              onClick={onOpenSmartFetcher}
              className="px-2 py-1 bg-blue-600/90 hover:bg-blue-600 text-white rounded text-[10px] sm:text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-all border border-blue-500/50 shrink-0 whitespace-nowrap"
              title="جلب نصوص السور والآيات والأحاديث المباشرة دون استهلاك توكنات"
            >
              <Database size={11} className="text-blue-200" />
              <span className="hidden sm:inline">جلب APIs والنصوص</span>
              <span className="sm:hidden">APIs</span>
            </button>
          )}

          {/* Quick Snippets Select */}
          <div className="flex items-center gap-1 shrink-0">
            <select
              value={selectedSnippetId}
              onChange={(e) => handleInsertSnippet(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded text-[10px] sm:text-[11px] text-slate-200 px-1.5 sm:px-2 py-1 outline-none focus:border-blue-500 cursor-pointer max-w-[105px] sm:max-w-[170px] truncate"
            >
              <option value="">نماذج وأكواد</option>
              {CODE_SNIPPETS.map(s => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>

          <div className="h-4 w-px bg-slate-700 mx-0.5 shrink-0" />

          {/* Copy Button */}
          <button
            onClick={handleCopyCode}
            className="p-1 sm:p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition-colors flex items-center gap-1 text-[11px] shrink-0"
            title="نسخ الكود"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span className="hidden md:inline">{copied ? 'تم النسخ' : 'نسخ'}</span>
          </button>

          {/* Clear Button */}
          <button
            onClick={handleClearCode}
            className="p-1 sm:p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-red-400 transition-colors shrink-0"
            title="مسح الكود"
          >
            <Trash2 size={13} />
          </button>
          
          {onToggleFocus && (
            <>
              <div className="h-4 w-px bg-slate-700 mx-0.5 shrink-0" />
              <button
                onClick={onToggleFocus}
                className="p-1 sm:p-1.5 hover:bg-amber-900/40 rounded text-amber-400/80 hover:text-amber-400 transition-colors flex items-center gap-1 text-[11px] shrink-0"
                title="التركيز العميق"
              >
                {isFocused ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-0.5 w-full bg-slate-800 shrink-0">
        <div 
          className="h-full bg-emerald-500 transition-all duration-150 ease-out shadow-[0_0_8px_rgba(16,185,129,0.5)]"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>
      {/* Main Monaco Editor */}
      <div className="flex-1 w-full relative">
        <Editor
          height="100%"
          defaultLanguage="python"
          theme="vs-dark"
          value={code}
          onChange={onChange}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            padding: { top: 14, bottom: 14 },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            tabSize: 4,
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
}
