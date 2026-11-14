import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User, Sparkles, Copy, Check, Plus, History, Trash2, Zap, Clock, MessageSquarePlus, ChevronDown, Globe, Search, ExternalLink, FileCode, Play, Download, RotateCcw, Volume2, VolumeX, Edit3, Music } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { markdownRehypePlugins } from '../lib/rehypeFixDomProps';
import { PreBlock, CodeBlock } from './MarkdownCodeBlocks';
import {
  sendChatMessage,
  sendChatMessageStream,
  AdvancedSettings,
  DEFAULT_SETTINGS,
  hasCodeOrEditorIntent,
  isPureGreetingOrSocial,
  getModelCapabilities
} from '../services/geminiService';
import QuranAudioPlayer from './QuranAudioPlayer';
import ChatInputForm from './ChatInputForm';
import { findSurahByNameOrNumber, QURAN_SURAHS_META } from '../services/quranApiService';
import { copyToClipboard } from '../lib/utils';

const generateUniqueId = (prefix = '') =>
  `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

function detectSurahInMessage(content: string): number | null {
  if (!content) return null;

  try {
    const jsonMatch = content.match(/\{[\s\S]*?"(surahNumber|surah_num|surahIdentifier|number)"\s*:\s*(\d+|"[^"]+")[^\}]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const sNum = parsed.surahNumber || parsed.surah_num || parsed.number || parsed.surahIdentifier;
      if (sNum) {
        const resolved = findSurahByNameOrNumber(sNum);
        if (resolved) return resolved;
      }
    }
  } catch(e) {}

  const surahMatches = Array.from(content.matchAll(/سورة\s+([\u0600-\u06FFa-zA-Z0-9]+(?:\s+[\u0600-\u06FFa-zA-Z0-9]+)?)/gi));
  for (const m of surahMatches) {
    if (m[1]) {
      const resolved = findSurahByNameOrNumber(m[1]);
      if (resolved) return resolved;
    }
  }

  return null;
}

export interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

export interface GroundingMetadata {
  webSearchQueries?: string[];
  groundingChunks?: GroundingChunk[];
  groundingSupports?: any[];
  searchEntryPoint?: { renderedContent?: string };
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  groundingMetadata?: GroundingMetadata;
}

export interface ChatSession {
  id: string;
  title: string;
  updatedAt: number;
  messages: Message[];
}

interface ChatPaneProps {
  currentCode: string;
  selectedModel: string;
  output?: string;
  images?: string[];
  onUpdateCode: (code: string) => void;
  onRunCode?: (code?: string) => Promise<void>;
  settings?: AdvancedSettings;
  onUpdateSettings?: (newSettings: AdvancedSettings) => void;
  onOpenSmartFetcher?: () => void;
  isFocused?: boolean;
  onToggleFocus?: () => void;
  onOpenApiKeyModal?: () => void;
}

const DEFAULT_WELCOME_MESSAGE: Message = {
  id: 'welcome-1',
  role: 'model',
  content: 'مرحباً بك! أنا "مداد الرحمن" والوكيل المخصص لبرمجة Python والعلوم الرقمية الإسلامية وتحليل البيانات.\n\nكيف يمكنني مساعدتك اليوم؟ يمكنك إخباري لتعديل الكود في المحرر فوراً، أو تجربة وتنفيد حزم بايثون، استخراج إحصاءات، ورسم المخططات البيانية.'
};

const ChatCodeBlock = (props: any) => <CodeBlock {...props} inlineTone="pink" />;

export default function ChatPane({
  currentCode,
  selectedModel,
  output = '',
  images = [],
  onUpdateCode,
  onRunCode,
  settings = DEFAULT_SETTINGS,
  onUpdateSettings,
  onOpenSmartFetcher,
  isFocused = false,
  onToggleFocus
}: ChatPaneProps) {
  
  // Storage initialization for Chat Sessions
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem('gemini-lab-chat-sessions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    
    // Default initial session
    const initSession: ChatSession = {
      id: generateUniqueId('session_'),
      title: 'محادثة رئيسية جديدة',
      updatedAt: Date.now(),
      messages: [DEFAULT_WELCOME_MESSAGE]
    };
    return [initSession];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem('gemini-lab-active-session');
      if (savedId && sessions.some(s => s.id === savedId)) return savedId;
    } catch (e) {}
    return sessions[0]?.id || generateUniqueId('session_');
  });

  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [externalInput, setExternalInput] = useState<string>('');
  const handleConsumeExternalInput = useCallback(() => setExternalInput(''), []);
  const [isLoading, setIsLoading] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  // Advanced Message Action States
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [appliedCodeMsgId, setAppliedCodeMsgId] = useState<string | null>(null);
  const [activeQuranPlayerMsgIds, setActiveQuranPlayerMsgIds] = useState<{[msgId: string]: boolean}>({});

  // Helper to extract code blocks from markdown text
  const extractCode = (text: string): string | null => {
    const matches = Array.from(text.matchAll(/```(?:python|py)?\s*([\s\S]*?)```/gi));
    if (matches.length > 0) {
      return matches.map(m => m[1].trim()).join('\n\n# --- كود متدفق آخر ---\n\n');
    }
    return null;
  };

  // Gemini AI Audio TTS Reader (gemini-3.8-flash-lite-tts / gemini-4-hydrogen)
  const handleToggleSpeech = async (msgId: string, text: string) => {
    if (speakingMsgId === msgId) {
      if ((window as any).__midadAudioPlayer) {
        (window as any).__midadAudioPlayer.pause();
        (window as any).__midadAudioPlayer = null;
      }
      setSpeakingMsgId(null);
      return;
    }

    if ((window as any).__midadAudioPlayer) {
      (window as any).__midadAudioPlayer.pause();
      (window as any).__midadAudioPlayer = null;
    }

    setSpeakingMsgId(msgId);
    try {
      const customKey = localStorage.getItem('gemini_user_api_key') || localStorage.getItem('gemini-custom-api-key') || '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (customKey) headers['x-custom-api-key'] = customKey;

      const res = await fetch('/api/gemini/tts', {
        method: 'POST',
        headers,
        body: JSON.stringify({ text, voice: 'Kore' })
      });
      const data = await res.json();
      if (!res.ok || !data.audioBase64) {
        throw new Error(data.error || 'فشل توليد التلاوة عبر نموذج جيميني الصوتي.');
      }

      const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
      (window as any).__midadAudioPlayer = audio;
      audio.onended = () => setSpeakingMsgId(null);
      audio.onerror = () => setSpeakingMsgId(null);
      await audio.play();
    } catch (err) {
      console.warn("Gemini audio playback warning:", err);
      setSpeakingMsgId(null);
      alert('تعذر تشغيل الصوت عبر نموذج جيميني: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Apply Code to Editor
  const handleApplyCodeToEditor = (msgId: string, text: string) => {
    const code = extractCode(text);
    if (code) {
      onUpdateCode(code);
      setAppliedCodeMsgId(msgId);
      setTimeout(() => setAppliedCodeMsgId(null), 2500);
    }
  };

  // Run Code directly
  const handleRunCodeFromMessage = async (msgId: string, text: string) => {
    const code = extractCode(text);
    if (code) {
      onUpdateCode(code);
      setAppliedCodeMsgId(msgId);
      if (onRunCode) {
        await onRunCode(code);
      }
    }
  };

  // Download Message as File
  const handleDownloadMessage = (msg: Message) => {
    const code = extractCode(msg.content);
    const textToDownload = code || msg.content;
    const ext = code ? 'py' : 'txt';
    const blob = new Blob([textToDownload], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `midad_${msg.role}_${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Delete Single Message
  const handleDeleteSingleMessage = (msgId: string) => {
    updateActiveSessionMessages(prev => prev.filter(m => m.id !== msgId));
  };

  // Regenerate/Re-ask Message
  const handleRegenerateMessage = (msgId: string) => {
    const idx = messages.findIndex(m => m.id === msgId);
    if (idx === -1) return;
    let userMsgText = '';
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMsgText = messages[i].content;
        break;
      }
    }
    if (userMsgText) {
      setExternalInput(userMsgText);
    }
  };

  // Active Session Helper
  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const messages = activeSession ? activeSession.messages : [DEFAULT_WELCOME_MESSAGE];

  // Sync to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('gemini-lab-chat-sessions', JSON.stringify(sessions));
      localStorage.setItem('gemini-lab-active-session', activeSessionId);
    } catch (e) {}
  }, [sessions, activeSessionId]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Create new session
  const handleCreateNewChat = () => {
    const newSession: ChatSession = {
      id: generateUniqueId('session_'),
      title: 'محادثة جديدة',
      updatedAt: Date.now(),
      messages: [DEFAULT_WELCOME_MESSAGE]
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setIsHistoryOpen(false);
  };

  // Delete session
  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length <= 1) {
      // Reset the only session
      const resetSession: ChatSession = {
        id: generateUniqueId('session_'),
        title: 'محادثة جديدة',
        updatedAt: Date.now(),
        messages: [DEFAULT_WELCOME_MESSAGE]
      };
      setSessions([resetSession]);
      setActiveSessionId(resetSession.id);
      return;
    }

    const updated = sessions.filter(s => s.id !== sessionId);
    setSessions(updated);
    if (activeSessionId === sessionId) {
      setActiveSessionId(updated[0].id);
    }
  };

  const handleClearAllSessions = () => {
    if (window.confirm("هل أنت تأكد من رغبتك في مسح كل سجل المحادثات والذاكرة؟")) {
      const newSession: ChatSession = {
        id: generateUniqueId('session_'),
        title: 'محادثة جديدة',
        updatedAt: Date.now(),
        messages: [DEFAULT_WELCOME_MESSAGE]
      };
      setSessions([newSession]);
      setActiveSessionId(newSession.id);
      setIsHistoryOpen(false);
    }
  };

  // Update active session messages
  const updateActiveSessionMessages = (updater: (prevMessages: Message[]) => Message[], customTitle?: string) => {
    setSessions(prevSessions => {
      return prevSessions.map(sess => {
        if (sess.id === activeSessionId) {
          const newMsgs = updater(sess.messages);
          let newTitle = sess.title;
          if (customTitle) {
            newTitle = customTitle;
          } else if (sess.title === 'محادثة جديدة' || sess.title === 'محادثة رئيسية جديدة') {
            const firstUserMsg = newMsgs.find(m => m.role === 'user');
            if (firstUserMsg) {
              newTitle = firstUserMsg.content.trim().slice(0, 32) + (firstUserMsg.content.length > 32 ? '...' : '');
            }
          }
          return {
            ...sess,
            title: newTitle,
            updatedAt: Date.now(),
            messages: newMsgs
          };
        }
        return sess;
      });
    });
  };

  const handleSendMessage = async (text: string, attachedFilesList: { name: string; content: string }[]) => {
    if ((!text.trim() && attachedFilesList.length === 0) || isLoading) return;

    const userMsgContent = text + (attachedFilesList.length > 0 ? `\n\n[تم إرفاق ${attachedFilesList.length} ملفات]` : '');
    const userMessage: Message = {
      id: generateUniqueId('msg_'),
      role: 'user',
      content: userMsgContent,
    };

    let attachmentsSnippet = '';
    if (attachedFilesList.length > 0) {
      attachmentsSnippet = '\n\nالمرفقات المضافة من قبل المستخدم (محتوى الملفات):\n' + attachedFilesList.map(f => `--- بداية ملف ${f.name} ---\n${f.content.substring(0, 100000)}\n--- نهاية ملف ${f.name} ---`).join('\n\n');
    }

    setExternalInput('');
    setIsLoading(true);

    const botMessageId = generateUniqueId('msg_');
    
    // Add User message & Initial empty Bot streaming message
    updateActiveSessionMessages(prev => [
      ...prev,
      userMessage,
      { id: botMessageId, role: 'model', content: '' }
    ]);

    try {
      const cappedOutput = output.length > 20000 ? output.substring(output.length - 20000) : output;
      const allowEditorMutation =
        !isPureGreetingOrSocial(text) &&
        hasCodeOrEditorIntent(text, attachedFilesList.length > 0);

      const systemContext = `أنت "مداد الرحمن" - المساعد والمهندس الخبير في علوم القرآن والحديث واللغة والتحليل الإحصائي وبرمجة Python.

محتوى الملف المفتوح حالياً في المحرر (مرجع للقراءة فقط - يُمنع تعديله إلا بطلب صريح من المستخدم):
\`\`\`text
${currentCode}
\`\`\`

نص المخرجات الحالي في شاشة العرض (للقراءة فقط):
\`\`\`text
${cappedOutput}
\`\`\`

تنبيهات وقواعد أساسية حازمة:
0. قاعدة الاستجابة الطبيعية (الأولوية القصوى): إذا أرسل المستخدم تحية (مثل "السلام عليكم"، "مرحباً") أو شكراً أو سؤالاً عاماً أو دينياً أو استفساراً نصياً لا يطلب فيه كتابة أو تعديل أو تشغيل كود، أجب بنص عربي واضح وودود مباشرةً، ويُمنع منعاً باتاً استدعاء أدوات (update_editor_code) أو (run_editor_code) أو تعديل المحرر.
1. جلب السور القرآنية والآيات: عند طلب المستخدم جلب سورة (مثل "سورة الأعلى"، "سورة الكهف"، "الأعلى"، أو رقم السورة)، استخدم أداة (fetch_quran_surah) فوراً بتمرير اسم السورة أو رقمها. يمنع منعاً باتاً هلوسة الآيات أو كتابة قواميس بايثون ثابتة مقتطعة تحتوي على تعليقات مثل "# متبوعاً بباقي الآيات".
2. عدم بتر المخرجات (No Token Limits): تم رفع حد التوكنات إلى 65,536 طوكن كاملاً. يُمنع التوقف في منتصف الاستجابة أو بتر النصوص أو الكود.
3. تحديث المحرر (عند الطلب الصريح فقط): فقط إذا طلب المستخدم صراحةً كتابة كود أو تعديله أو إصلاحه أو تحليله برمجياً، استخدم أداة (update_editor_code) لوضع الكود كاملاً في المحرر، واستخدم (run_editor_code) فقط عند طلب التشغيل.
4. بيئة بايثون (Sandbox): تعمل محلياً بدون اتصال مباشر بالشبكة الخارجية (لا تعمل فيها urllib.request أو requests وتتسبب بخطأ Temporary failure in name resolution). لذلك، عند كتابة كود تحليل، استخدم أداة (fetch_quran_surah) أو (fetch_api_data) أولاً ثم ضمّن البيانات المجلوبة مباشرة داخل كود بايثون في المحرر عبر (update_editor_code).
5. المعالجة المكتملة: تأكد من معالجة وعرض جميع الآيات من الأولى إلى الأخيرة 100% بدون أي حذف أو اختصار.
6. الخطوط العربية للمخطوطات: إذا طلب المستخدم عرض الآيات أو النصوص بخطوط معينة (مثل الرقعة، الكوفي، النسخ، الفارسي، التعليق)، استخدم وسوم HTML مضمنة في ردك \`<span style="font-family: 'اسم الخط', serif; font-size: 1.5em; line-height: 2;">النص هنا</span>\`. الخطوط المتاحة: للنسخ ('Amiri', 'Scheherazade New', 'Lateef')، للرقعة ('Aref Ruqaa')، للكوفي ('Reem Kufi')، للفارسي والتعليق ('Noto Nastaliq Urdu')، للعناوين ('Lalezar', 'Qahiri')، وللخطوط الحديثة ('Tajawal').
7. دقة الإحصاء القرآني في الرسم العثماني: عند كتابة كود Python لإحصاء كلمات أو حروف سورة مجلوبة بصيغة \`ar.uthmani\` أو \`quran-simple-clean\`، التزم بالآتي بدقة:
   - عالج المسافة الدقيقة قبل الألف الخنجرية (مثل \`إِبۡرَ ٰ⁠هِیمَ\`) عبر \`re.sub(r'[\\s\\u200a]+(?=\\u0670)', '', text)\` قبل \`split()\` حتى لا تُحسب الكلمة كلمتين.
   - أزل كافة التشكيل وعلامات الوقف (مثل \`ۚ\` المنفصلة في \`quran-simple-clean\`) والتطويل والألف الخنجرية والمحارف المخفية \`[\\u0610-\\u061A\\u0640\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\u08D3-\\u08FF\\u200a\\u200b-\\u200d\\u2060\\ufeff]\`، ووحّد الياء الفارسية (\`ی\` U+06CC) مع (\`ي\` U+064A).
   - احسب عدد حروف كل آية من النص المنظَّف نفسه (\`cleaned\`) لا من النص الخام، حتى يتطابق مجموع عمود الآيات 100% مع الإجمالي الكلي للحروف.
   - افصل البسملة المدمجة في بداية الآية 1 لغير الفاتحة والتوبة (أو وضّح صراحةً الحسابين: مع البسملة وبدونها)، ووضّح للمستخدم المنهج المتّبع: الرسم الإملائي القياسي (\`quran-simple-clean\`) أم الرسم العثماني الحديث أم العد التراثي على الرسم الأول (الذي يُسقط الألف الخنجرية والهمزة المنفردة \`ء\`).`;
      
      const chatHistory = messages.map(m => ({ role: m.role, content: m.content }));
      chatHistory.push({ role: 'user', content: text + attachmentsSnippet });

      let lastUpdateTime = 0;
      let pendingUpdateTimeout: any = null;

      // REAL-TIME STREAMING INVOCATION
      const response = await sendChatMessageStream(
        chatHistory,
        systemContext,
        selectedModel,
        images,
        settings,
        (streamedText) => {
          const now = Date.now();
          if (now - lastUpdateTime > 16) {
            lastUpdateTime = now;
            updateActiveSessionMessages(prev => 
              prev.map(m => m.id === botMessageId ? { ...m, content: streamedText } : m)
            );
            if (pendingUpdateTimeout) {
              clearTimeout(pendingUpdateTimeout);
              pendingUpdateTimeout = null;
            }
          } else if (!pendingUpdateTimeout) {
            pendingUpdateTimeout = setTimeout(() => {
              updateActiveSessionMessages(prev => 
                prev.map(m => m.id === botMessageId ? { ...m, content: streamedText } : m)
              );
              lastUpdateTime = Date.now();
              pendingUpdateTimeout = null;
            }, 16);
          }
        }
      );
      
      // Ensure the final timeout is cleared and final text is applied
      if (pendingUpdateTimeout) {
        clearTimeout(pendingUpdateTimeout);
      }
      updateActiveSessionMessages(prev => 
        prev.map(m => m.id === botMessageId ? { ...m, content: response.text || "" } : m)
      );
      
      let finalResponseText = response.text || "";
      if (response.functionCalls && response.functionCalls.length > 0) {
        let madeChanges = false;
        let ranCode = false;
        let latestCode = currentCode;
        let rejectedEditorToolCall = false;

        for (const call of response.functionCalls) {
          if (call.name === 'update_editor_code') {
            if (!allowEditorMutation) {
              rejectedEditorToolCall = true;
              continue;
            }
            const newCode = (call.args as any)?.code;
            if (typeof newCode === 'string' && newCode.trim().length > 0 && newCode !== currentCode) {
              onUpdateCode(newCode);
              latestCode = newCode;
              madeChanges = true;
            }
          }
          if (call.name === 'run_editor_code' && onRunCode) {
            if (!allowEditorMutation) {
              rejectedEditorToolCall = true;
              continue;
            }
            ranCode = true;
            await onRunCode(latestCode);
          }
        }

        if (!finalResponseText.trim()) {
          if (rejectedEditorToolCall && !madeChanges && !ranCode) {
            const fallbackResponse = await sendChatMessage(
              chatHistory,
              systemContext,
              selectedModel,
              images,
              { ...settings, enableEditorTools: false, enableGoogleSearch: false }
            );
            finalResponseText = fallbackResponse.text || "وعليكم السلام ورحمة الله وبركاته! كيف يمكنني مساعدتك اليوم؟";
          } else if (madeChanges && ranCode) {
            finalResponseText = "لقد قمت بتحديث الكود وتشغيله. يمكنك مشاهدة النتائج الآن في لوحة المخرجات!";
          } else if (madeChanges) {
            finalResponseText = "تم تحديث الكود في المحرر بناءً على طلبك.";
          } else if (ranCode) {
            finalResponseText = "قمت بإعطاء أمر تشغيل الكود، النتائج ستظهر أمامك للحظات.";
          }
        } else if (madeChanges || ranCode) {
          finalResponseText += "\n\n*(تم تنفيذ الإجراءات والتحديثات تلقائياً في الواجهة)*";
        }
      }

      // Finalize bot message content
      updateActiveSessionMessages(prev => 
        prev.map(m => m.id === botMessageId ? {
          ...m,
          content: finalResponseText || "سأستمر في مساعدتك.",
          groundingMetadata: response.groundingMetadata
        } : m)
      );

    } catch (error: any) {
      const errMsg = error?.message || 'تعذر جلب الاستجابة.';
      let extraNote = '';
      if (errMsg.includes('مفتاح') || errMsg.includes('API_KEY')) {
        extraNote = '\n\n💡 **تنبيه:** يمكنك التحقق من المفتاح المدمج في بيئة العمل أو إدخال مفتاحك الشخصي عبر زر المفتاح (🔑) أعلى الشاشة.';
      } else if (errMsg.includes('429') || errMsg.includes('Quota')) {
        extraNote = '\n\n💡 **تنبيه:** تم تجاوز الحصة المؤقتة. جرب نموذجاً أسرع مثل (Gemini 2.5 Flash أو 3.1 Flash Lite) أو أدخل مفتاحاً مخصصاً.';
      }
      updateActiveSessionMessages(prev => 
        prev.map(m => m.id === botMessageId ? { ...m, content: `**خطأ في الاتصال:** ${errMsg}${extraNote}` } : m)
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 justify-between relative" dir="rtl">
      
      {/* Sub-Header: Chat Sessions, Model Badge & Focus Mode (Compact Single Line) */}
      <div className="px-2 sm:px-3 py-1 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200 gap-1.5 overflow-x-auto scrollbar-none shrink-0 z-20" dir="rtl">
        
        {/* Left: Chat Sessions Dropdown Toggle & Deep Focus Button */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 text-slate-800 dark:text-slate-200 px-2 py-0.5 sm:py-1 rounded-md shadow-2xs transition-all font-bold hover:bg-blue-50/50 dark:hover:bg-slate-700 text-[10px] sm:text-[11px]"
            title="عرض سجل المحادثات والذاكرة"
          >
            <History size={12} className="text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="truncate max-w-[70px] sm:max-w-[130px]">{activeSession?.title || 'المحادثات'}</span>
            <ChevronDown size={11} className={`text-slate-400 transition-transform shrink-0 ${isHistoryOpen ? 'rotate-180' : ''}`} />
          </button>

          <button
            onClick={handleCreateNewChat}
            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 sm:py-1 rounded-md shadow-2xs transition-all font-bold text-[10px] sm:text-[11px] whitespace-nowrap"
            title="بدء محادثة جديدة وحفظ الحالية تلقائياً"
          >
            <Plus size={12} />
            <span>جديدة</span>
          </button>

          {/* Deep Focus Toggle Button */}
          {onToggleFocus && (
            <button
              onClick={onToggleFocus}
              className={`flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-[11px] font-bold transition-all shadow-2xs border ${
                isFocused 
                  ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600' 
                  : 'bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700/80'
              }`}
              title={isFocused ? 'خروج من وضع التركيز' : 'تفعيل وضع التركيز العميق (إخفاء كل المشتتات)'}
            >
              <Sparkles size={11} className={isFocused ? "text-white" : "text-amber-600 dark:text-amber-400"} />
              <span>{isFocused ? 'خروج' : 'التركيز العميق'}</span>
            </button>
          )}

          {/* One-Click Search & Tools Toggle Button (enables Bridge on non-native models like Gemma) */}
          {(() => {
            const caps = getModelCapabilities(selectedModel);
            const isSearchAndToolsOn = Boolean(settings.enableGoogleSearch && settings.enableEditorTools);
            const isBridgeActive = isSearchAndToolsOn && (settings.enableToolBridge !== false) && (!caps.supportsGoogleSearch || !caps.supportsFunctionCalling || !caps.supportsHybridTools);

            const handleToggleSearchAndTools = () => {
              if (!onUpdateSettings) return;
              const nextState = !isSearchAndToolsOn;
              onUpdateSettings({
                ...settings,
                enableGoogleSearch: nextState,
                enableEditorTools: nextState,
                enableToolBridge: nextState
              });
            };

            return (
              <button
                type="button"
                onClick={handleToggleSearchAndTools}
                disabled={!onUpdateSettings}
                className={`flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-[11px] font-bold transition-all shadow-2xs border whitespace-nowrap ${
                  isSearchAndToolsOn
                    ? isBridgeActive
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700'
                      : 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700'
                    : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                }`}
                title={
                  isSearchAndToolsOn
                    ? isBridgeActive
                      ? 'البحث والأدوات مفعّلان عبر الجسر الذكي لتمكين هذا النموذج من البحث واستخدام الأدوات'
                      : 'البحث المباشر وأدوات المحرر مفعّلان — انقر لتعطيلهما'
                    : 'البحث والأدوات معطّلان — انقر لتفعيلهما لجميع النماذج (بما في ذلك النماذج غير الداعمة)'
                }
              >
                <Globe size={11} className={isSearchAndToolsOn ? "text-white" : "text-slate-400"} />
                <span>
                  {isSearchAndToolsOn
                    ? (isBridgeActive ? 'البحث والأدوات (جسر نشط)' : 'البحث والأدوات: مفعّل')
                    : 'تفعيل البحث والأدوات'}
                </span>
              </button>
            );
          })()}
        </div>

        {/* Right: Selected Model Badge & Streaming Indicator */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <span 
            className="text-[10px] text-amber-800 dark:text-amber-300 font-mono font-semibold bg-amber-50 dark:bg-amber-950/60 px-1.5 sm:px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/60 max-w-[110px] sm:max-w-[180px] truncate"
            dir="ltr"
            title="النموذج المعتمد حالياً لهذه المحادثة"
          >
            {selectedModel}
          </span>
          <div className="flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-800 whitespace-nowrap">
            <Zap size={10} className="fill-emerald-500 animate-pulse shrink-0" />
            <span className="hidden sm:inline">لحظي</span>
          </div>
        </div>
      </div>

      {/* History Sessions Drawer Dropdown */}
      {isHistoryOpen && (
        <div className="absolute top-[37px] right-2 left-2 z-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-3 bg-slate-900 dark:bg-slate-950 text-white flex justify-between items-center text-xs font-bold border-b border-slate-800">
            <span className="flex items-center gap-1.5">
              <History size={14} className="text-blue-400" />
              سجل المحادثات والذاكرة المحفوظة ({sessions.length})
            </span>
            <button
              onClick={handleClearAllSessions}
              className="text-slate-400 hover:text-red-400 text-[11px] font-normal flex items-center gap-1 transition-colors"
            >
              <Trash2 size={12} />
              مسح السجل بالكامل
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto p-2 space-y-1">
            {sessions.map(sess => (
              <div
                key={sess.id}
                onClick={() => {
                  setActiveSessionId(sess.id);
                  setIsHistoryOpen(false);
                }}
                className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-all ${
                  sess.id === activeSessionId
                    ? 'bg-blue-50/80 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 font-bold text-blue-900 dark:text-blue-300'
                    : 'bg-white dark:bg-slate-800/80 border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <MessageSquarePlus size={14} className={sess.id === activeSessionId ? "text-blue-600 dark:text-blue-400" : "text-slate-400"} />
                  <div className="truncate">
                    <p className="truncate font-semibold">{sess.title}</p>
                    <p className="text-[10px] text-slate-400 font-normal flex items-center gap-1 mt-0.5">
                      <Clock size={10} />
                      {new Date(sess.updatedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })} • {sess.messages.length} رسائل
                    </p>
                  </div>
                </div>

                <button
                  onClick={(e) => handleDeleteSession(sess.id, e)}
                  className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded transition-colors"
                  title="حذف المحادثة"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages Scroll View */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
        {messages
          .filter(msg => (msg.content && msg.content.trim() !== '') || (isLoading && msg.role === 'model'))
          .map((msg) => {
          const detectedSurahNum = detectSurahInMessage(msg.content);
          return (
          <div key={msg.id} className={`flex gap-2 sm:gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`} dir="rtl">
             <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 sm:mt-1 ${msg.role === 'user' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300' : 'bg-[#eff6ff] dark:bg-blue-950/60 text-[#3b82f6] dark:text-blue-400'}`}>
               {msg.role === 'user' ? <User size={15} /> : <Sparkles size={15} />}
             </div>
             <div className={`w-full max-w-[94%] sm:max-w-[85%] min-w-0 break-words [overflow-wrap:anywhere] px-3 sm:px-4 py-2.5 sm:py-3 text-[13px] sm:text-[14px] leading-relaxed shadow-xs ${msg.role === 'user' ? 'bg-[#f1f5f9] dark:bg-slate-800 text-[#1e293b] dark:text-slate-100 rounded-2xl rounded-tr-sm' : 'bg-[#f8fafc] dark:bg-slate-900 text-[#1e293b] dark:text-slate-100 rounded-lg border-r-4 border-r-[#3b82f6] border border-[#e2e8f0] dark:border-slate-800'}`}>
               {msg.role === 'user' ? (
                 <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{msg.content}</p>
               ) : (
                 <>
                   <div className="markdown-body prose prose-slate dark:prose-invert prose-sm max-w-none text-right break-words [overflow-wrap:anywhere] min-w-0" dir="rtl">
                      {msg.content === '' && isLoading ? (
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs py-1.5 font-sans">
                          <Zap size={14} className="animate-spin text-blue-500 shrink-0" />
                          <span>جاري صياغة وكتابة الرد لحظياً...</span>
                        </div>
                      ) : (
                        <ReactMarkdown
                          rehypePlugins={markdownRehypePlugins}
                          components={{
                            code: ChatCodeBlock,
                            pre: PreBlock,
                            audio: ({ node, src, ...props }) => {
                              return (
                                <div className="my-2.5 p-3 bg-slate-50 dark:bg-slate-800/90 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-2xs text-right" dir="rtl">
                                  <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300 text-xs mb-1.5">
                                    <Music size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                                    <span>المشغل الصوتي المباشر</span>
                                  </div>
                                  <audio
                                    controls
                                    preload="metadata"
                                    className="w-full h-10 rounded-lg outline-none"
                                    src={src}
                                    onError={() => {
                                      console.warn("Audio element load error caught gracefully:", src);
                                    }}
                                    {...props}
                                  />
                                  {src && (
                                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px] flex-wrap">
                                      <a
                                        href={src}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors shadow-2xs"
                                      >
                                        <Download size={12} />
                                        <span>رابط التحميل المباشر MP3</span>
                                      </a>
                                      <a
                                        href={src}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 font-medium hover:underline"
                                      >
                                        <ExternalLink size={11} />
                                        <span>فتح الملف في صفحة جديدة</span>
                                      </a>
                                    </div>
                                  )}
                                </div>
                              );
                            },
                            a: ({ node, href, children, ...props }) => {
                              const isAudio = href && (href.endsWith('.mp3') || href.endsWith('.wav') || href.includes('/mp3') || href.includes('mp3quran.net'));
                              if (isAudio && href) {
                                return (
                                  <span className="inline-block my-1.5 w-full">
                                    <a
                                      href={href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      download
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-bold text-xs transition-all shadow-2xs my-1"
                                    >
                                      <Music size={13} className="text-amber-600 dark:text-amber-400" />
                                      <span>{children || 'رابط التحميل المباشر MP3'}</span>
                                      <Download size={12} className="mr-1 text-amber-600 dark:text-amber-400" />
                                    </a>
                                  </span>
                                );
                              }
                              return (
                                <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold" {...props}>
                                  {children}
                                </a>
                              );
                            }
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      )}
                   </div>

                   {/* Embedded Quran Audio Player & Complete Reader */}
                   {detectedSurahNum && (activeQuranPlayerMsgIds[msg.id] || (msg.role === 'model' && msg.content.includes('"numberOfAyahs"'))) && (
                     <div className="mt-3 pt-2 border-t border-amber-200 dark:border-amber-900/50">
                       <QuranAudioPlayer
                         surahNumber={detectedSurahNum}
                         surahName={QURAN_SURAHS_META.find(s => s.number === detectedSurahNum)?.name}
                       />
                     </div>
                   )}

                   {/* Interactive Google Search Grounding Card */}
                   {msg.groundingMetadata && (
                     ((msg.groundingMetadata.webSearchQueries && msg.groundingMetadata.webSearchQueries.length > 0) ||
                      (msg.groundingMetadata.groundingChunks && msg.groundingMetadata.groundingChunks.length > 0)) && (
                       <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
                         <div className="flex items-center gap-1.5 font-bold text-blue-600 dark:text-blue-400 mb-2">
                           <Globe size={13} className="animate-pulse text-blue-500" />
                           <span>مصادر واستعلامات الويب المباشرة (Google Search Grounding)</span>
                         </div>

                         {msg.groundingMetadata.webSearchQueries && msg.groundingMetadata.webSearchQueries.length > 0 && (
                           <div className="mb-2">
                             <span className="text-slate-500 dark:text-slate-400 text-[10px] block mb-1 font-semibold">الاستعلامات المبحث عنها حياً:</span>
                             <div className="flex flex-wrap gap-1.5">
                               {msg.groundingMetadata.webSearchQueries.map((q, idx) => (
                                 <span key={idx} className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 text-[11px] font-medium shadow-2xs">
                                   <Search size={10} className="text-blue-500 shrink-0" />
                                   {q}
                                 </span>
                               ))}
                             </div>
                           </div>
                         )}

                         {msg.groundingMetadata.groundingChunks && msg.groundingMetadata.groundingChunks.length > 0 && (
                           <div>
                             <span className="text-slate-500 dark:text-slate-400 text-[10px] block mb-1 font-semibold">المصادر المقتبس منها من الويب:</span>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1">
                               {msg.groundingMetadata.groundingChunks.map((chunk, idx) => {
                                 const uri = chunk.web?.uri;
                                 const title = chunk.web?.title || uri;
                                 if (!uri) return null;
                                 let domain = '';
                                 try { domain = new URL(uri).hostname; } catch(e) { domain = uri; }
                                 return (
                                   <a
                                     key={idx}
                                     href={uri}
                                     target="_blank"
                                     rel="noopener noreferrer"
                                     className="flex items-center justify-between gap-1.5 bg-blue-50/70 dark:bg-slate-800/80 hover:bg-blue-100 dark:hover:bg-slate-700/80 p-2 rounded-lg border border-blue-200/60 dark:border-slate-700 text-blue-700 dark:text-blue-300 transition-all truncate group shadow-2xs"
                                   >
                                     <div className="truncate flex flex-col">
                                       <span className="font-semibold text-[11px] truncate group-hover:underline">{title}</span>
                                       <span className="text-[9px] text-slate-400 dark:text-slate-500 truncate">{domain}</span>
                                     </div>
                                     <ExternalLink size={12} className="shrink-0 text-blue-500 dark:text-blue-400" />
                                   </a>
                                 );
                               })}
                             </div>
                           </div>
                         )}
                       </div>
                     )
                   )}
                 </>
               )}

               {/* Advanced Message Action Toolbar */}
               {msg.content !== '' && (
                 <div className={`mt-2 pt-1.5 border-t flex items-center gap-1 sm:gap-1.5 flex-wrap text-[10px] sm:text-[11px] ${
                   msg.role === 'user' 
                     ? 'border-slate-200/60 dark:border-slate-700/60 justify-end text-slate-500' 
                     : 'border-slate-200/80 dark:border-slate-800/80 justify-start text-slate-500'
                 }`}>
                   {/* Quran Audio Player Button */}
                   {detectedSurahNum && (
                     <button
                       onClick={() => {
                         setActiveQuranPlayerMsgIds(prev => ({
                           ...prev,
                           [msg.id]: !prev[msg.id]
                         }));
                       }}
                       className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 transition-all font-bold shadow-2xs"
                       title="فتح مشغل القرآن الكريم والاستماع للتلاوة الصوتية بالكامل"
                     >
                       <Music size={13} className="text-amber-600 dark:text-amber-400" />
                       <span>
                         {activeQuranPlayerMsgIds[msg.id]
                           ? 'إغلاق مشغل الصوت'
                           : `مشغل التلاوة الصوتية 🎧 (${QURAN_SURAHS_META.find(s => s.number === detectedSurahNum)?.name || `سورة ${detectedSurahNum}`})`}
                       </span>
                     </button>
                   )}

                   {/* Copy Button */}
                   <button
                     onClick={async () => {
                       const ok = await copyToClipboard(msg.content);
                       if (ok) {
                         setCopiedMsgId(msg.id);
                         setTimeout(() => setCopiedMsgId(null), 2000);
                       }
                     }}
                     className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors font-medium shadow-2xs"
                     title="نسخ نص الرسالة بالكامل"
                   >
                     {copiedMsgId === msg.id ? (
                       <>
                         <Check size={12} className="text-emerald-500" />
                         <span className="text-emerald-600 dark:text-emerald-400 font-bold">تم النسخ</span>
                       </>
                     ) : (
                       <>
                         <Copy size={12} />
                         <span>نسخ</span>
                       </>
                     )}
                   </button>

                   {/* Apply Code to Editor (If Code Block Present) */}
                   {extractCode(msg.content) && (
                     <>
                       <button
                         onClick={() => handleApplyCodeToEditor(msg.id, msg.content)}
                         className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 transition-all font-semibold shadow-2xs"
                         title="استخراج الكود وتطبيقه في محرر بايثون مباشرة"
                       >
                         <FileCode size={12} className="text-blue-600 dark:text-blue-400" />
                         {appliedCodeMsgId === msg.id ? (
                           <span className="text-emerald-600 dark:text-emerald-400 font-bold">تم التثبيت بالمحرر ✨</span>
                         ) : (
                           <span>وضع الكود بالمحرر</span>
                         )}
                       </button>

                       {onRunCode && (
                         <button
                           onClick={() => handleRunCodeFromMessage(msg.id, msg.content)}
                           className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 transition-all font-semibold shadow-2xs"
                           title="نقل الكود للمحرر وتشغيله فوراً"
                         >
                           <Play size={12} className="fill-emerald-600 dark:fill-emerald-400" />
                           <span>تشغيل بالمحرر</span>
                         </button>
                       )}
                     </>
                   )}

                   {/* Text To Speech Read Aloud */}
                   <button
                     onClick={() => handleToggleSpeech(msg.id, msg.content)}
                     className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors font-medium shadow-2xs ${
                       speakingMsgId === msg.id
                         ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 animate-pulse border border-amber-300 dark:border-amber-700'
                         : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                     }`}
                     title={speakingMsgId === msg.id ? "إيقاف القراءة الصوتية" : "استماع / قراءة نصية صوتية"}
                   >
                     {speakingMsgId === msg.id ? (
                       <>
                         <VolumeX size={12} className="text-amber-600 dark:text-amber-400" />
                         <span>إيقاف الصوت</span>
                       </>
                     ) : (
                       <>
                         <Volume2 size={12} />
                         <span>قراءة صوتية</span>
                       </>
                     )}
                   </button>

                   {/* Download Message as File */}
                   <button
                     onClick={() => handleDownloadMessage(msg)}
                     className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors font-medium shadow-2xs"
                     title="تنزيل الرسالة كملف نصي أو كود بايثون"
                   >
                     <Download size={12} />
                     <span>حفظ كملف</span>
                   </button>

                   {/* Edit / Put Back in Input (User Message) */}
                   {msg.role === 'user' && (
                     <button
                       onClick={() => setExternalInput(msg.content)}
                       className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors font-medium shadow-2xs"
                       title="نسخ النص إلى صندوق الكتابة لتعديله وإعادة الإرسال"
                     >
                       <Edit3 size={12} />
                       <span>تعديل</span>
                     </button>
                   )}

                   {/* Regenerate Response (AI Message) */}
                   {msg.role === 'model' && (
                     <button
                       onClick={() => handleRegenerateMessage(msg.id)}
                       className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors font-medium shadow-2xs"
                       title="استرجع السؤال لصندوق الإدخال لإعادة التوليد"
                     >
                       <RotateCcw size={12} />
                       <span>إعادة السؤال</span>
                     </button>
                   )}

                   {/* Delete Single Message */}
                   {messages.length > 1 && (
                     <button
                       onClick={() => handleDeleteSingleMessage(msg.id)}
                       className="flex items-center gap-1 px-1.5 py-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                       title="حذف هذه الرسالة فقط"
                     >
                       <Trash2 size={12} />
                     </button>
                   )}
                 </div>
               )}
             </div>
          </div>
        );
        })}

        <div ref={endOfMessagesRef} />
      </div>

      {/* Input Area (Isolated Component for smooth, zero-lag typing) */}
      <ChatInputForm
        isLoading={isLoading}
        onSendMessage={handleSendMessage}
        onOpenSmartFetcher={onOpenSmartFetcher}
        externalInput={externalInput}
        onConsumeExternalInput={handleConsumeExternalInput}
      />
    </div>
  );
}