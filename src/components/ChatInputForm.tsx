import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X, Database } from 'lucide-react';
import { Button } from './ui/button';

interface ChatInputFormProps {
  isLoading: boolean;
  onSendMessage: (text: string, attachedFiles: { name: string; content: string }[]) => void;
  onOpenSmartFetcher?: () => void;
  externalInput?: string;
  onConsumeExternalInput?: () => void;
}

export function ChatInputForm({
  isLoading,
  onSendMessage,
  onOpenSmartFetcher,
  externalInput = '',
  onConsumeExternalInput
}: ChatInputFormProps) {
  const [input, setInput] = useState<string>('');
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; content: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync external input if provided (e.g. from regenerate or smart fetcher)
  useEffect(() => {
    if (externalInput) {
      setInput(externalInput);
      onConsumeExternalInput?.();
    }
  }, [externalInput, onConsumeExternalInput]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          setAttachedFiles(prev => [...prev, { name: file.name, content }]);
        };
        reader.readAsText(file);
      });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && attachedFiles.length === 0) || isLoading) return;

    onSendMessage(input, attachedFiles);
    setInput('');
    setAttachedFiles([]);
  };

  return (
    <div className="p-3 bg-white dark:bg-slate-900 border-t border-[#e2e8f0] dark:border-slate-800">
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2" dir="rtl">
          {attachedFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] shadow-xs font-medium">
              <span className="truncate max-w-[150px] font-mono">{f.name}</span>
              <button
                type="button"
                onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))}
                className="text-slate-400 hover:text-red-500 p-0.5 select-none text-center"
              >
                <X size={12} strokeWidth={3} />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Button
          type="submit"
          size="icon"
          disabled={isLoading || (!input.trim() && attachedFiles.length === 0)}
          className="bg-blue-600 hover:bg-blue-700 text-white shrink-0 rounded-lg shadow-xs border-0"
        >
          <Send size={16} className="rotate-180" />
        </Button>
        <div className="flex-1 relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="اسأل Gemini أو اطلب تعديل كود بايثون وحسابه..."
            className="w-full bg-white dark:bg-slate-800/90 border border-[#e2e8f0] dark:border-slate-700 rounded-lg pl-10 pr-4 py-2 text-[13px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors shadow-xs"
            dir="rtl"
          />
          <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {onOpenSmartFetcher && (
              <button
                type="button"
                onClick={onOpenSmartFetcher}
                className="p-1.5 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-md transition-colors"
                title="جلب نصوص السور والآيات والأحاديث المباشرة (توفير التوكنات)"
              >
                <Database size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-md transition-colors"
              title="إرفاق ملف"
            >
              <Paperclip size={16} />
            </button>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            multiple
            accept=".txt,.csv,.json,.md,.xml,.log"
          />
        </div>
      </form>
    </div>
  );
}

export default React.memo(ChatInputForm);
