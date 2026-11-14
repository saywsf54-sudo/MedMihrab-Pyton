import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard } from '../lib/utils';

export function extractTextFromChildren(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractTextFromChildren).join('');
  if (React.isValidElement(node) && (node.props as any)?.children !== undefined) {
    return extractTextFromChildren((node.props as any).children);
  }
  return '';
}

export const PreBlock = ({ children }: { children?: React.ReactNode }) => {
  const [copied, setCopied] = useState(false);
  const codeString = extractTextFromChildren(children).replace(/\n$/, '');

  const handleCopy = async () => {
    const ok = await copyToClipboard(codeString);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative group my-4" dir="ltr">
      <div className="absolute top-2 right-2 z-10 flex">
        <button
          type="button"
          onClick={handleCopy}
          className="p-1.5 bg-[#1e293b]/80 backdrop-blur-sm text-slate-300 hover:text-white hover:bg-emerald-500 rounded-md transition-all shadow-sm border border-slate-600/50"
          title="نسخ الكود"
        >
          {copied ? <Check size={14} className="text-white" /> : <Copy size={14} />}
        </button>
      </div>
      <pre
        data-code-block="true"
        className="!bg-[#0f172a] !text-slate-50 !p-4 !m-0 rounded-xl overflow-x-auto text-[13px] font-mono shadow-sm border border-slate-700"
      >
        {children}
      </pre>
    </div>
  );
};

interface CodeBlockProps extends React.HTMLAttributes<HTMLElement> {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  inlineTone?: 'pink' | 'amber';
}

export const CodeBlock = ({
  inline,
  className,
  children,
  inlineTone = 'pink',
  ...props
}: CodeBlockProps) => {
  const match = /language-(\w+)/.exec(className || '');
  const codeString = String(children);
  const isBlock = inline === false || Boolean(match) || codeString.includes('\n');

  if (isBlock) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  }

  const toneClasses =
    inlineTone === 'amber'
      ? 'text-amber-700 dark:text-amber-300 text-xs'
      : 'text-pink-600 dark:text-pink-400 text-[12px]';

  return (
    <code
      className={`bg-slate-100 dark:bg-slate-800 ${toneClasses} px-1.5 py-0.5 rounded font-mono [[data-code-block]>&]:bg-transparent [[data-code-block]>&]:text-inherit [[data-code-block]>&]:p-0 [[data-code-block]>&]:rounded-none [[data-code-block]>&]:text-[13px] ${className || ''}`}
      {...props}
    >
      {children}
    </code>
  );
};
