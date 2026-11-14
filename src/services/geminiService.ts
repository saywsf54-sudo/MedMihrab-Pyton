import { GoogleGenAI, Content, Type } from "@google/genai";
import { fetchSurahFromApi, fetchAyahFromApi, fetchHadithFromApi, fetchQuranAudioFromApi } from "./quranApiService";
import {
  getModelCapabilities,
  resolveActualModelId,
  resolveToolSelectionForModel,
  foldSystemInstructionIntoContents,
  isUnsupportedCapabilityError,
  downgradeConfigForUnsupportedError,
  isQuotaOrRateLimitError,
  isRetryableModelFallbackError,
  markModelRateLimited,
  clearModelRateLimits,
  orderModelsByAvailability,
  formatUserFriendlyAiError,
  hasWebSearchIntent,
  buildToolBridgeProtocolPrompt,
  parseBridgeToolCalls,
  formatGroundingFromSearchResults,
  extractSearchKeywords,
  type ModelCapabilities,
} from "../lib/modelCapabilities";

export { getModelCapabilities, resolveActualModelId, type ModelCapabilities };

export interface ApiKeyStatus {
  key: string;
  source: 'custom' | 'env' | 'none';
  maskedKey: string;
}

export function getCustomApiKey(): string {
  try {
    return (localStorage.getItem('gemini_user_api_key') || localStorage.getItem('gemini-custom-api-key') || '').trim();
  } catch {
    return '';
  }
}

export function setCustomApiKey(key: string): void {
  try {
    const trimmed = key ? key.trim() : '';
    if (trimmed) {
      localStorage.setItem('gemini_user_api_key', trimmed);
    } else {
      localStorage.removeItem('gemini_user_api_key');
      localStorage.removeItem('gemini-custom-api-key');
    }
  } catch (e) {
    console.error("Error saving custom API key:", e);
  }
  // Invalidate cached client and reset rate-limit cooldowns for new key
  aiClient = null;
  currentClientApiKey = null;
  clearModelRateLimits();
}

export function getInternalEnvApiKey(): string {
  try {
    const proc = typeof process !== 'undefined' ? process.env : null;
    const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : null;
    const win = typeof window !== 'undefined' ? (window as any) : null;

    const envKey =
      proc?.GEMINI_API_KEY ||
      proc?.API_KEY ||
      metaEnv?.VITE_GEMINI_API_KEY ||
      metaEnv?.GEMINI_API_KEY ||
      win?.GEMINI_API_KEY ||
      win?.__GEMINI_API_KEY__ ||
      '';

    if (envKey && typeof envKey === 'string' && envKey.trim()) {
      return envKey.trim();
    }
  } catch {}
  return '';
}

export function getApiKeyStatus(): ApiKeyStatus {
  const custom = getCustomApiKey();
  if (custom) {
    const masked = custom.length > 8 ? `${custom.slice(0, 4)}...${custom.slice(-4)}` : '••••••••';
    return { key: custom, source: 'custom', maskedKey: masked };
  }
  const envKey = getInternalEnvApiKey();
  if (envKey) {
    const masked = envKey.length > 8 ? `${envKey.slice(0, 4)}...${envKey.slice(-4)}` : '••••••••';
    return { key: envKey, source: 'env', maskedKey: masked };
  }
  return { key: '', source: 'none', maskedKey: '' };
}

export const FALLBACK_MODELS_CHAIN = [
  'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemma-4-26b-a4b-it'
];

export function getModelSequence(primaryModel?: string): string[] {
  const cleanPrimary = resolveActualModelId(primaryModel || 'gemini-2.5-flash');
  const sequence = [cleanPrimary];
  for (const fb of FALLBACK_MODELS_CHAIN) {
    const cleanFb = resolveActualModelId(fb);
    if (!sequence.includes(cleanFb)) {
      sequence.push(cleanFb);
    }
  }
  return orderModelsByAvailability(sequence);
}

let aiClient: GoogleGenAI | null = null;
let currentClientApiKey: string | null = null;

export function getClient(): GoogleGenAI {
  const status = getApiKeyStatus();
  const key = status.key;
  if (!key) {
    throw new Error(
      "لم يتم العثور على مفتاح API (GEMINI_API_KEY). يرجى التأكد من البيئة أو إدخال مفتاحك المخصص من زر المفتاح (🔑) في شريط الأدوات."
    );
  }
  if (!aiClient || currentClientApiKey !== key) {
    aiClient = new GoogleGenAI({ apiKey: key });
    currentClientApiKey = key;
  }
  return aiClient;
}

export async function testApiKeyConnection(testKey?: string, preferredModel?: string): Promise<{ success: boolean; message: string }> {
  try {
    const keyToTest = (testKey !== undefined ? testKey.trim() : getApiKeyStatus().key);
    if (!keyToTest) {
      return { success: false, message: "لم يتم العثور على أي مفتاح للاختبار. يرجى إدخال مفتاح API أولاً." };
    }
    const testClient = new GoogleGenAI({ apiKey: keyToTest });
    const modelsToTry = getModelSequence(preferredModel || 'gemini-2.5-flash');
    let lastErrorMsg = '';

    for (const modelId of modelsToTry) {
      try {
        const probe = await testClient.models.generateContent({
          model: modelId,
          contents: 'مرحبا',
          config: { maxOutputTokens: 10 }
        });
        if (probe) {
          return { success: true, message: `تم الاتصال واختبار المفتاح بنجاح عبر نموذج (${modelId})!` };
        }
      } catch (err: any) {
        lastErrorMsg = err?.message || String(err);
        if (lastErrorMsg.includes("API_KEY_INVALID") || lastErrorMsg.includes("401") || lastErrorMsg.includes("403")) {
          return { success: false, message: "مفتاح API غير صالح أو غير مفعل (خطأ 401/403). يرجى التأكد من نسخه بشكل صحيح من Google AI Studio." };
        }
        // If 404 or 429, loop continues to attempt next fallback model in order
      }
    }

    if (lastErrorMsg.includes("429") || lastErrorMsg.includes("RESOURCE_EXHAUSTED")) {
      return { success: true, message: "المفتاح صحيح ومتصل، لكن تم استهلاك الحد اليومي/الدقيقة المسموح به (429 Quota Exceeded)." };
    }

    return { success: false, message: `تعذر الاتصال بالمفتاح: ${lastErrorMsg}` };
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes("API_KEY_INVALID") || msg.includes("401") || msg.includes("403")) {
      return { success: false, message: "مفتاح API غير صالح أو غير مفعل (خطأ 401/403). يرجى التأكد من نسخه بشكل صحيح." };
    }
    return { success: false, message: `تعذر الاتصال بالمفتاح: ${msg}` };
  }
}

async function executeServerSideToolCall(toolCall: any): Promise<string> {
  const name = toolCall.name;
  const args = toolCall.args || {};

  if (name === "fetch_quran_audio") {
    const surahId = args.surahIdentifier || args.surahNumber || args.surahName || args.surah || 1;
    const reciter = args.reciter || args.edition || "ar.alafasy";
    const ayahNum = args.ayahNumber;
    try {
      const data = await fetchQuranAudioFromApi(surahId, reciter, ayahNum);
      return JSON.stringify(data);
    } catch (e: any) {
      return "Error fetching Quran audio: " + e.message;
    }
  }

  if (name === "fetch_quran_surah") {
    const surahId = args.surahIdentifier || args.surahNumber || args.surahName || args.surah || 1;
    const edition = args.edition || "ar.uthmani";
    try {
      const data = await fetchSurahFromApi(surahId, edition);
      // Return 100% full Surah text and ayahs without any length slice or truncation
      return JSON.stringify(data);
    } catch (e: any) {
      return "Error fetching Surah: " + e.message;
    }
  }

  if (name === "fetch_quran_ayah") {
    const surahNum = args.surahNumber || 1;
    const ayahNum = args.ayahNumber || 1;
    const edition = args.edition || "ar.uthmani";
    try {
      const data = await fetchAyahFromApi(surahNum, ayahNum, edition);
      return JSON.stringify(data);
    } catch (e: any) {
      return "Error fetching Ayah: " + e.message;
    }
  }

  if (name === "fetch_hadith_data") {
    const book = args.book || "bukhari";
    const number = args.number || 1;
    try {
      const data = await fetchHadithFromApi(book, number);
      return JSON.stringify(data);
    } catch (e: any) {
      return "Error fetching Hadith: " + e.message;
    }
  }

  if (name === "fetch_api_data") {
    const url = args.url;
    if (!url) return "Error: no URL provided";
    try {
      const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error("Status " + res.status);
      return await res.text();
    } catch (e: any) {
      return "Error fetching URL: " + e.message;
    }
  }

  return "Unknown tool";
}

export interface ModelOption {
  id: string;
  name: string;
}

export interface AdvancedSettings {
  temperature: number;
  topP: number;
  topK: number;
  maxOutputTokens: number;
  enableGoogleSearch: boolean;
  enableEditorTools: boolean;
  enableToolBridge: boolean;
  systemPromptOverride: string;
  executionTimeoutSeconds: number;
}

export const DEFAULT_SETTINGS: AdvancedSettings = {
  temperature: 0.7,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 65536,
  enableGoogleSearch: true,
  enableEditorTools: true,
  enableToolBridge: true,
  systemPromptOverride: "",
  executionTimeoutSeconds: 45,
};

export function normalizeArabicForIntent(text: string): string {
  return (text || '')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim()
    .toLowerCase();
}

export function hasCodeOrEditorIntent(text: string, hasAttachments = false): boolean {
  if (hasAttachments) return true;
  const norm = normalizeArabicForIntent(text);
  if (!norm) return false;

  const codeKeywords =
    /(كود|اكواد|برمج|برمجه|بايثون|python|محرر|editor|سكربت|سكريبت|script|داله|دوال|function|مكتبه|pandas|numpy|matplotlib|scipy|json|csv|api|خوارزم|algorithm|شغل|تشغيل|تنفيذ|نفذ|run|execute|عدل|تعديل|تحديث|حدث|اكتب|كتابه|انشئ|انشاء|اصنع|صمم|ولد|توليد|صحح|تصحيح|اصلح|اصلاح|debug|fix|refactor|optimize|ارسم|رسم|مخطط|بياني|chart|plot|graph|احسب|حساب|احصاء|احصائ|تحليل|تردد|تكرار|الجمل|برنامج|تطبيق|مثال|اضف|احذف|امسح|استبدل|غير|بدل|طور|حسن|اجعل|ضع)/i;
  return codeKeywords.test(norm);
}

export function isPureGreetingOrSocial(text: string): boolean {
  const norm = normalizeArabicForIntent(text).replace(/[!؟?.,،؛:\-_"'\(\)\[\]]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!norm) return false;
  if (hasCodeOrEditorIntent(text, false)) return false;
  if (/(سوره|ايه|ايات|حديث|احاديث|قران|تفسير|تلاوه|قارئ|معني|حكم|شرح|ما هو|ما هي|من هو|كيف |لماذا|كم |متي|اين)/.test(norm)) {
    return false;
  }

  const greetingRegex =
    /^(السلام عليكم(?: ورحمه الله(?: وبركاته)?)?|وعليكم السلام(?: ورحمه الله(?: وبركاته)?)?|سلام عليكم|سلام|مرحبا(?: بك| بكم| يا \S+)?|اهلا(?: وسهلا| بك| بكم| فيك)?|اهلين|هلا(?: والله| بك)?|حياك الله|صباح الخير|صباح النور|مساء الخير|مساء النور|كيف حالك|كيف الحال|شلونك|اخبارك|شخبارك|عامل ايه|ازيك|شكرا(?: لك| جزيلا)?|مشكور|جزاك الله خيرا?|بارك الله فيك|يعطيك العافيه|تسلم|تمام|طيب|حسنا|ماشي|ممتاز|احسنت|hi|hello|hey|good morning|good evening|how are you|thanks|thank you|ok|okay|bye|salam|assalamu alaikum)$/;
  return greetingRegex.test(norm);
}

export const AGENT_PRESETS = [
  {
    id: "quran_digital",
    title: "خبير حساب القرآن والعلوم الرقمية (مداد الرحمن)",
    desc: "متخصص في حسابات الألفاظ، الجمل، رسم المخططات البيانية واستخراج الإحصاءات القرآنية ببايثون.",
    systemPrompt: `أنت "مداد الرحمن" - الوكيل والمهندس الخبير في العلوم الرقمية الإسلامية وحسابات القرآن الكريم والحديث الشريف.
مهامك الرئيسية:
1. الرد بنص عربي واضح وودود على التحيات والأسئلة العامة والدينية دون استدعاء أدوات تعديل المحرر.
2. عند طلب المستخدم جلب سورة قرآنية (مثل سورة الأعلى، سورة الكهف، إلخ)، استخدم أداة (fetch_quran_surah) مع اسم أو رقم السورة لجلب النص كاملاً 100% دون أي اقتطاع أو هلوسة.
3. فقط عندما يطلب المستخدم كتابة أو تعديل أو تحليل برمجي بالكود، استخدم أداة (update_editor_code) لوضع الكود كاملاً في المحرر دون اختصارات أو تعليقات مقتطعة.
4. رسم المخططات البيانية والجداول الإحصائية باستخدام matplotlib و pandas عند طلب التحليل البرمجي.
5. الالتزام بالدقة التامة في النصوص القرآنية والأحاديث النبوية بدون هلوسة، والإجابة بلغة عربية فصيحة، رصينة ومحترفة.`
  },
  {
    id: "data_science",
    title: "عالم بيانات وتحليل إحصائي متقدم",
    desc: "متخصص في السلاسل الزمنية، معالجة البيانات الضخمة، المخططات المتقدمة والهندسة الإحصائية.",
    systemPrompt: `أنت عالم بيانات وخبير تحليل إحصائي محترف بلغة بايثون.
مهامك الرئيسية:
1. الرد نصياً على التحيات والأسئلة النظرية دون تعديل المحرر إلا بطلب برمجي صريح.
2. تحليل البيانات، معالجة الجداول، بناء نماذج التنبؤ والإحصاء باستعمال pandas, numpy, scipy.
3. توليد رسوم بيانية تفاعلية وبصرية جذابة باستخدام matplotlib ووضع الكود في المحرر عبر update_editor_code عند طلب كتابة أو تعديل الكود.
4. شرح النتائج الإحصائية والاستنتاجات العلمية بوضوح وإيجاز.`
  },
  {
    id: "algo_architect",
    title: "مهندس خوارزميات وهيكلة برمجية",
    desc: "متخصص في تحسين كفاءة الكود، التعقيد الزمني والمكاني (Big-O)، والتطوير المتقدم.",
    systemPrompt: `أنت خبير هندسة البرمجيات وبناء الخوارزميات المتقدمة في بايثون.
مهامك الرئيسية:
1. الرد نصياً على التحيات والاستفسارات النظرية دون استدعاء أدوات التعديل ما لم يطلب المستخدم كوداً.
2. صياغة أكواد نظيفة، موثقة ومعالجة للأخطاء (Clean Code & Error Handling) وتحسين الأداء.
3. وضع الكود الجاهز للتنفيذ في المحرر عبر update_editor_code عند طلب المستخدم كتابة أو تعديل الكود.
4. تقديم شرح لبنية الخوارزمية وتوزيع البيانات.`
  },
  {
    id: "web_scraper",
    title: "خبير جلب وتحليل بيانات الويب (Web Data Fetcher)",
    desc: "مساعد متخصص في استخراج البيانات من الويب والـ APIs وتحويلها إلى تحليلات رسمية.",
    systemPrompt: `أنت خبير جلب البيانات وتحليل شبكة الويب والـ APIs.
مهامك الرئيسية:
1. الرد نصياً على التحيات والأسئلة العامة دون تعديل المحرر إلا عند وجود طلب برمجي.
2. استخدام أداة fetch_api_data عند الحاجة لقراءة البيانات المباشرة من الروابط والخدمات.
3. عند طلب التحليل البرمجي، تحويل البيانات المجلوبة إلى متغيرات وهياكل بايثون وتحديث المحرر بـ update_editor_code.`
  }
];

export async function generateSmartPersona(userHint: string, modelName: string = "gemini-2.5-flash"): Promise<string> {
  const ai = getClient();
  let prompt = "";
  if (userHint && userHint.trim()) {
    prompt = `أنت خبير هندسة الأوامر (Prompt Engineering Expert). بناءً على هذه الملاحظات أو الكلمات المفتاحية من المستخدم: "${userHint.trim()}"، قم بتوسيعها وصياغة توجيه خبير ذكي جداً (System Instruction) باللغة العربية.
يجب أن يوجه الذكاء الاصطناعي لـ:
1. كتابة أكواد بايثون احترافية دقيقة متصلة بهذا المجال.
2. استخدام أداة update_editor_code لوضع الكود تلقائياً في المحرر.
3. تنفيذ وتوليد رسوم بيانية بـ matplotlib واستخراج نتائج عملية.
اكتب نص التوجيه المباشر فقط بدون مقدمات ولا ختامات ولا علامات تنصيص.`;
  } else {
    prompt = `أنت خبير هندسة الأوامر (Prompt Engineer). قم بتوليد توجيه نظام مخصص وعبقري (System Instruction) لخبير ذكي جداً يدمج بين "حسابات القرآن الكريم والعلوم الرقمية الإسلامية" و"تحليل البيانات البرمجية في بايثون".
يجب أن يشمل التوجيه:
- التخصص في حساب الجمل، إحصاء الحروف، معالجة النصوص، ورسم المخططات البيانية بـ matplotlib.
- استخدام أداة update_editor_code لتحديث المحرر فورياً.
- الدقة والموثوقية العالية في معالجة البيانات والتحليلات.
اكتب نص التوجيه المباشر باللغة العربية الفصيحة فقط بدون أي كلام جانبي.`;
  }

  try {
    const candidates = getModelSequence(modelName);
    for (const candidateModel of candidates) {
      try {
        const caps = getModelCapabilities(candidateModel);
        const res = await ai.models.generateContent({
          model: candidateModel,
          contents: prompt,
          config: caps.supportsSamplingParams ? { temperature: 0.8 } : {}
        });
        const text = res.text?.trim();
        if (text) return text;
      } catch (err: any) {
        if (isQuotaOrRateLimitError(err)) {
          markModelRateLimited(candidateModel);
        }
        if (!isRetryableModelFallbackError(err)) {
          throw err;
        }
      }
    }
    return AGENT_PRESETS[0].systemPrompt;
  } catch (err) {
    console.warn("Error generating smart persona:", err);
    if (userHint && userHint.trim()) {
      return `أنت خبير ومساعد متخصص في (${userHint.trim()}). تقوم بكتابة وتطوير أكواد بايثون عالية الجودة، وتحديث المحرر بـ update_editor_code وتشغيلها، وتجهيز رسوم بيانية وتتبع النتائج بدقة.`;
    }
    return AGENT_PRESETS[0].systemPrompt;
  }
}

export const DEFAULT_ALL_MODELS: ModelOption[] = [
  { id: 'gemini-2.5-flash', name: 'gemini-2.5-flash' },
  { id: 'gemini-2.5-pro', name: 'gemini-2.5-pro' },
  { id: 'gemma-4-26b-a4b-it', name: 'gemma-4-26b-a4b-it' },
  { id: 'gemma-4-31b-it', name: 'gemma-4-31b-it' },
  { id: 'gemini-2.5-flash-lite', name: 'gemini-2.5-flash-lite' },
  { id: 'gemini-2.5-flash-image', name: 'gemini-2.5-flash-image' },
  { id: 'gemini-3.1-flash-lite', name: 'gemini-3.1-flash-lite' },
  { id: 'gemini-3-pro-image', name: 'gemini-3-pro-image' },
  { id: 'gemini-3.1-flash-image', name: 'gemini-3.1-flash-image' },
  { id: 'gemini-3.1-flash-lite-image', name: 'gemini-3.1-flash-lite-image' },
  { id: 'gemini-nano-banana-2.1', name: 'gemini-nano-banana-2.1' },
  { id: 'gemini-3.5-flash', name: 'gemini-3.5-flash' },
  { id: 'gemini-3.5-flash-lite', name: 'gemini-3.5-flash-lite' },
  { id: 'gemini-omni-flash-preview', name: 'gemini-omni-flash-preview' },
  { id: 'gemini-3.6-flash', name: 'gemini-3.6-flash' },
  { id: 'gemini-3.7-flash', name: 'gemini-3.7-flash' },
  { id: 'gemini-3.8-flash', name: 'gemini-3.8-flash' },
  { id: 'gemini-4-argon', name: 'gemini-4-argon' },
  { id: 'gemini-4-carbon', name: 'gemini-4-carbon' },
  { id: 'gemini-4-hydrogen', name: 'gemini-4-hydrogen' },
  { id: 'antigravity-preview-05-2026', name: 'antigravity-preview-05-2026' },
  { id: 'antigravity-preview-09-2026', name: 'antigravity-preview-09-2026' },
  { id: 'antigravity-preview-latest', name: 'antigravity-preview-latest' },
  { id: 'deep-research-max-preview-04-2026', name: 'deep-research-max-preview-04-2026' },
  { id: 'deep-research-preview-04-2026', name: 'deep-research-preview-04-2026' },
  { id: 'deep-research-pro-preview-12-2025', name: 'deep-research-pro-preview-12-2025' },
  { id: 'gemini-embedding-001', name: 'gemini-embedding-001' },
  { id: 'gemini-embedding-2', name: 'gemini-embedding-2' }
];

export async function fetchAvailableModels(forceRefresh = false): Promise<ModelOption[]> {
  const uniqueMap = new Map<string, ModelOption>();

  const collectFromList = (rawList: any[]) => {
    for (const m of rawList) {
      const rawName = (m?.name || m?.id || '').trim();
      const cleanId = rawName.replace(/^models\//, '');
      if (!cleanId) continue;
      if (!uniqueMap.has(cleanId)) {
        uniqueMap.set(cleanId, {
          id: cleanId,
          name: cleanId,
        });
      }
    }
  };

  try {
    const status = getApiKeyStatus();
    if (status.key) {
      const ai = getClient();
      const response = await ai.models.list({ config: { pageSize: 1000 } });

      const modelsList: any[] = [];
      if (Array.isArray(response)) {
        modelsList.push(...response);
      } else if (response && typeof (response as any)[Symbol.asyncIterator] === 'function') {
        for await (const m of (response as any)) {
          modelsList.push(m);
        }
      } else if ((response as any)?.models && Array.isArray((response as any).models)) {
        modelsList.push(...(response as any).models);
      }

      if (modelsList.length > 0) {
        collectFromList(modelsList);
      }
    }
  } catch (err) {
    console.warn("Client models.list fallback to server proxy:", err);
  }

  // Always check server endpoint if client list had no key or returned 0 models
  if (uniqueMap.size === 0 && typeof fetch !== 'undefined') {
    try {
      const customKey = getCustomApiKey();
      const headers: Record<string, string> = {};
      if (customKey) headers['x-custom-api-key'] = customKey;
      const res = await fetch(`/api/gemini/models${forceRefresh ? '?refresh=1' : ''}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.models) && data.models.length > 0) {
          collectFromList(data.models);
        }
      }
    } catch (serverErr) {
      console.warn("Could not fetch models from server endpoint:", serverErr);
    }
  }

  if (uniqueMap.size > 0) {
    return Array.from(uniqueMap.values());
  }

  return DEFAULT_ALL_MODELS;
}

function buildChatDeclarations(allowEditorMutation: boolean): any[] {
  const declarations: any[] = [
    {
      name: "fetch_quran_audio",
      description: "Fetches recitation audio streams, reciter info, and ayah audio URLs for any Surah or Ayah in the Quran with support for all major reciters (Alafasy, Abdul Basit, Minshawi, Husary, Sudais, Shuraym, Maher, Warsh, etc.).",
      parameters: {
        type: Type.OBJECT,
        properties: {
          surahIdentifier: { type: Type.STRING, description: "Surah number (1-114) or Surah name (e.g. '2', 'البقرة', 'يوسف', 'الكهف')" },
          reciter: { type: Type.STRING, description: "Reciter ID e.g. ar.alafasy, ar.abdulbasitmurattal, ar.minshawi, ar.husary, ar.saoodshuraym, ar.sudais, ar.mahermuaiqly, ar.ghamadi" },
          ayahNumber: { type: Type.NUMBER, description: "Optional Ayah number for specific verse audio" }
        },
        required: ["surahIdentifier"]
      }
    },
    {
      name: "fetch_quran_surah",
      description: "Fetches complete text and metadata of a Quran Surah (1 to 114, or by Surah name e.g. 'الأعلى', 'سورة الكهف', '87') directly via API 100% complete without truncation.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          surahIdentifier: { type: Type.STRING, description: "Surah number (1-114) or Surah name in Arabic/English (e.g. '87', 'الأعلى', '18', 'الكهف')" },
          edition: { type: Type.STRING, description: "Edition/Riwayah identifier (e.g. ar.uthmani, ar.warsh, ar.alafasy)" }
        },
        required: ["surahIdentifier"]
      }
    },
    {
      name: "fetch_quran_ayah",
      description: "Fetches specific Quran Ayah text directly via API to save tokens.",
      parameters: { type: Type.OBJECT, properties: { surahNumber: { type: Type.NUMBER }, ayahNumber: { type: Type.NUMBER }, edition: { type: Type.STRING } }, required: ["surahNumber", "ayahNumber"] }
    },
    {
      name: "fetch_hadith_data",
      description: "Fetches Hadith text from books (bukhari, muslim, abudawud, tirmidhi, nasai, ibnmajah) directly via API.",
      parameters: { type: Type.OBJECT, properties: { book: { type: Type.STRING, description: "Book identifier e.g. bukhari, muslim" }, number: { type: Type.NUMBER, description: "Hadith number" } }, required: ["book", "number"] }
    },
    {
      name: "fetch_api_data",
      description: "Fetches data (JSON/Text) from a web API or URL given the url. Use this BEFORE writing python code if you need web data, because the Python sandbox lacks internet access.",
      parameters: { type: Type.OBJECT, properties: { url: { type: Type.STRING, description: "The complete URL to fetch" } }, required: ["url"] }
    }
  ];

  if (allowEditorMutation) {
    declarations.unshift(
      {
        name: "update_editor_code",
        description: "Updates the python code inside the IDE editor. ONLY call this tool when the user explicitly requests writing, editing, fixing, or placing code into the editor. NEVER call this for greetings or general questions.",
        parameters: { type: Type.OBJECT, properties: { code: { type: Type.STRING, description: "The complete new source code to place in the editor" } }, required: ["code"] }
      },
      {
        name: "run_editor_code",
        description: "Runs the current python code in the IDE and evaluates the results. ONLY call this when the user explicitly asks to execute or run code.",
      }
    );
  }

  return declarations;
}

async function performClientWebSearchBridge(query: string): Promise<{ results: { title: string; snippet: string; url: string }[]; groundingMetadata: any }> {
  const cleanQuery = extractSearchKeywords(query);
  if (!cleanQuery) return { results: [], groundingMetadata: null };

  try {
    if (typeof fetch !== 'undefined') {
      const res = await fetch(`/api/web-search?q=${encodeURIComponent(cleanQuery)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.results) && data.results.length > 0) {
          return {
            results: data.results,
            groundingMetadata: data.groundingMetadata || formatGroundingFromSearchResults(data.results, cleanQuery),
          };
        }
      }
    }
  } catch {}

  try {
    const hasArabic = /[\u0600-\u06FF]/.test(cleanQuery);
    const wikiLang = hasArabic ? 'ar' : 'en';
    const wikiRes = await fetch(`https://${wikiLang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&utf8=1&format=json&origin=*&srlimit=4`);
    if (wikiRes.ok) {
      const wikiJson = await wikiRes.json();
      const hits = wikiJson?.query?.search || [];
      const results = hits.map((h: any) => ({
        title: String(h.title || ''),
        snippet: String(h.snippet || '').replace(/<[^>]+>/g, ''),
        url: `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(String(h.title || '').replace(/\s+/g, '_'))}`,
      })).filter((r: any) => r.title);
      return {
        results,
        groundingMetadata: formatGroundingFromSearchResults(results, cleanQuery),
      };
    }
  } catch {}

  return { results: [], groundingMetadata: null };
}

function buildCapabilityAwareChatRequest(
  actualModelName: string,
  contents: Content[],
  effectiveSystemInstruction: string,
  settings: AdvancedSettings,
  isGreetingTurn: boolean,
  allowEditorMutation: boolean,
  lastUserMessage: string
) {
  const declarations = buildChatDeclarations(allowEditorMutation);
  const toolSelection = resolveToolSelectionForModel({
    modelId: actualModelName,
    enableEditorTools: settings.enableEditorTools,
    enableGoogleSearch: settings.enableGoogleSearch,
    isGreetingTurn,
    allowEditorMutation,
    lastUserMessage,
    declarations,
  });

  const caps = toolSelection.capabilities;
  const wantsTools = Boolean(settings.enableEditorTools) && !isGreetingTurn;
  const wantsSearch = Boolean(settings.enableGoogleSearch) && !isGreetingTurn;
  const bridgeEnabled = settings.enableToolBridge !== false;

  const needsFunctionBridge = bridgeEnabled && wantsTools && !toolSelection.usedFunctionDeclarations;
  const needsSearchBridge = bridgeEnabled && wantsSearch && !toolSelection.usedGoogleSearch;
  const usingToolBridge = needsFunctionBridge || needsSearchBridge;

  const modelSystemInstruction = usingToolBridge
    ? `${effectiveSystemInstruction}\n\n${buildToolBridgeProtocolPrompt(allowEditorMutation, needsFunctionBridge, needsSearchBridge)}`
    : effectiveSystemInstruction;

  const config: any = {
    maxOutputTokens: settings.maxOutputTokens ?? 65536,
  };

  if (caps.supportsSamplingParams) {
    config.temperature = settings.temperature ?? 0.7;
    config.topP = settings.topP ?? 0.95;
    config.topK = settings.topK ?? 40;
  }

  let preparedContents: any[] = contents;
  if (caps.supportsSystemInstruction) {
    config.systemInstruction = modelSystemInstruction;
  } else {
    preparedContents = foldSystemInstructionIntoContents(contents, modelSystemInstruction);
  }

  if (toolSelection.tools.length > 0) {
    config.tools = toolSelection.tools;
  }
  if (toolSelection.toolConfig) {
    config.toolConfig = toolSelection.toolConfig;
  }

  return {
    config,
    preparedContents,
    toolSelection,
    modelSystemInstruction,
    needsFunctionBridge,
    needsSearchBridge,
    usingToolBridge,
  };
}

async function sendChatMessageForModel(
  ai: GoogleGenAI,
  actualModelName: string,
  baseContents: Content[],
  effectiveSystemInstruction: string,
  settings: AdvancedSettings,
  isGreetingTurn: boolean,
  allowEditorMutation: boolean,
  lastUserMessage: string
): Promise<{ text: string; functionCalls?: any[]; groundingMetadata?: any }> {
  let enrichedInstruction = effectiveSystemInstruction;
  let bridgeGrounding: any = null;

  const preCheckSelection = resolveToolSelectionForModel({
    modelId: actualModelName,
    enableEditorTools: settings.enableEditorTools,
    enableGoogleSearch: settings.enableGoogleSearch,
    isGreetingTurn,
    allowEditorMutation,
    lastUserMessage,
    declarations: buildChatDeclarations(allowEditorMutation),
  });

  if (
    settings.enableToolBridge !== false &&
    settings.enableGoogleSearch &&
    !isGreetingTurn &&
    !preCheckSelection.usedGoogleSearch &&
    hasWebSearchIntent(lastUserMessage)
  ) {
    const preSearch = await performClientWebSearchBridge(lastUserMessage);
    if (preSearch.results.length > 0) {
      bridgeGrounding = preSearch.groundingMetadata;
      enrichedInstruction += `\n\n--- نتائج البحث المباشر من الويب ---\n${JSON.stringify(preSearch.results, null, 2)}\nاستخدم هذه المعلومات والمصادر الموثوقة في إجابتك.`;
    }
  }

  const initial = buildCapabilityAwareChatRequest(
    actualModelName,
    baseContents,
    enrichedInstruction,
    settings,
    isGreetingTurn,
    allowEditorMutation,
    lastUserMessage
  );

  let activeContents: any[] = initial.preparedContents;
  let activeConfig: any = initial.config;

  const invokeGenerate = async () => {
    for (let attempt = 0; attempt <= 3; attempt++) {
      try {
        return await ai.models.generateContent({
          model: actualModelName,
          contents: activeContents,
          config: activeConfig
        });
      } catch (err: any) {
        if (!isUnsupportedCapabilityError(err)) {
          throw err;
        }
        const downgraded = downgradeConfigForUnsupportedError(
          activeContents,
          activeConfig,
          initial.modelSystemInstruction,
          attempt
        );
        if (!downgraded) throw err;
        console.warn(`Adjusting request config for model ${actualModelName} compatibility (step ${attempt + 1}).`);
        activeContents = downgraded.contents;
        activeConfig = downgraded.config;
      }
    }
    throw new Error("فشل الاتصال بالنموذج بعد محاولات التوافق التلقائي.");
  };

  let response = await invokeGenerate();

  let text = "";
  try { text = response.text || ""; } catch(e) {}

  let groundingMetadata = response.candidates?.[0]?.groundingMetadata || bridgeGrounding;
  let extraFunctionCalls: any[] = [];

  if (initial.usingToolBridge && text) {
    const parsedBridge = parseBridgeToolCalls(text);
    text = parsedBridge.cleanedText;

    if (parsedBridge.toolCalls.length > 0) {
      const bridgeDataOutputs: string[] = [];
      for (const bCall of parsedBridge.toolCalls) {
        if (bCall.name === 'update_editor_code' || bCall.name === 'run_editor_code') {
          if (allowEditorMutation) {
            extraFunctionCalls.push({ name: bCall.name, args: bCall.args });
          }
        } else if (bCall.name === 'web_search') {
          const searchRes = await performClientWebSearchBridge(String(bCall.args?.query || lastUserMessage));
          if (searchRes.groundingMetadata) groundingMetadata = searchRes.groundingMetadata;
          bridgeDataOutputs.push(`نتائج web_search:\n${JSON.stringify(searchRes.results)}`);
        } else {
          const toolOut = await executeServerSideToolCall(bCall);
          bridgeDataOutputs.push(`نتيجة ${bCall.name}:\n${toolOut}`);
        }
      }

      if (bridgeDataOutputs.length > 0) {
        activeContents = [
          ...activeContents,
          { role: 'model', parts: [{ text: parsedBridge.cleanedText || 'جاري جلب البيانات عبر الأداة...' }] },
          { role: 'user', parts: [{ text: `إليك البيانات الحقيقية المجلوبة من الأدوات:\n\n${bridgeDataOutputs.join('\n\n')}\n\nقدّم الإجابة النهائية الدقيقة والمفيدة للمستخدم الآن دون إخراج وسوم TOOL_CALL.` }] }
        ];
        response = await invokeGenerate();
        try { text = response.text || ""; } catch(e) {}
        const secondParse = parseBridgeToolCalls(text);
        text = secondParse.cleanedText;
        for (const bCall of secondParse.toolCalls) {
          if ((bCall.name === 'update_editor_code' || bCall.name === 'run_editor_code') && allowEditorMutation) {
            extraFunctionCalls.push({ name: bCall.name, args: bCall.args });
          }
        }
      }
    }
  }

  const fetchTools = ["fetch_quran_surah", "fetch_quran_ayah", "fetch_hadith_data", "fetch_api_data", "fetch_quran_audio"];
  let loopCount = 0;

  while (loopCount < 3) {
    const functionCalls = response.functionCalls;
    if (!functionCalls || !functionCalls.some(c => fetchTools.includes(c.name || ''))) {
      break;
    }

    const toolCall = functionCalls.find(c => fetchTools.includes(c.name || ''))!;
    const fetchedContent = await executeServerSideToolCall(toolCall);

    const modelContent = response.candidates?.[0]?.content;
    if (modelContent) {
      activeContents.push(modelContent);
    } else {
      activeContents.push({
        role: 'model',
        parts: [{ functionCall: toolCall as any }]
      });
    }

    activeContents.push({
      role: 'user',
      parts: [{
        functionResponse: {
          ...(toolCall.id ? { id: toolCall.id } : {}),
          name: toolCall.name,
          response: { result: fetchedContent }
        }
      }]
    } as any);

    response = await invokeGenerate();

    try { text = response.text || ""; } catch(e) {}
    if (response.candidates?.[0]?.groundingMetadata) {
      groundingMetadata = response.candidates[0].groundingMetadata;
    }
    loopCount++;
  }

  const mergedCalls = [...(response.functionCalls || []), ...extraFunctionCalls];
  return {
    text,
    functionCalls: mergedCalls.length > 0 ? mergedCalls : undefined,
    groundingMetadata
  };
}

export async function sendChatMessage(
  messages: {role: string, content: string}[],
  systemInstruction: string,
  modelName: string = "gemini-2.5-flash",
  currentImagesBase64: string[] = [],
  settings: AdvancedSettings = DEFAULT_SETTINGS
): Promise<{text: string, functionCalls?: any[], groundingMetadata?: any}> {
  const ai = getClient();

  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  const isGreetingTurn = isPureGreetingOrSocial(lastUserMessage);
  const allowEditorMutation = !isGreetingTurn && hasCodeOrEditorIntent(lastUserMessage, currentImagesBase64.length > 0);

  const effectiveSystemInstruction = settings.systemPromptOverride && settings.systemPromptOverride.trim()
    ? `${settings.systemPromptOverride.trim()}\n\n--- التعليمات والسياق التقني التشغيلي ---\n${systemInstruction}`
    : systemInstruction;

  const baseContents: Content[] = messages
    .filter(msg => msg.content && msg.content.trim().length > 0)
    .map((msg, index, arr) => {
      const parts: any[] = [{ text: msg.content }];

      // Attach current plot images to the very last user message for context
      if (index === arr.length - 1 && msg.role === 'user' && currentImagesBase64.length > 0) {
         currentImagesBase64.forEach(img => {
           try {
             const mimeType = img.split(';')[0].split(':')[1];
             const data = img.split(',')[1];
             if (mimeType && data) {
               parts.push({ inlineData: { data, mimeType } });
             }
           } catch(e) {}
         });
      }

      return {
        role: msg.role === 'user' ? 'user' : 'model',
        parts
      };
    });

  const candidateModels = getModelSequence(modelName);
  let lastErr: any = null;

  for (const candidateModel of candidateModels) {
    try {
      return await sendChatMessageForModel(
        ai,
        candidateModel,
        baseContents,
        effectiveSystemInstruction,
        settings,
        isGreetingTurn,
        allowEditorMutation,
        lastUserMessage
      );
    } catch (err: any) {
      lastErr = err;
      if (isQuotaOrRateLimitError(err)) {
        markModelRateLimited(candidateModel);
      }
      if (isRetryableModelFallbackError(err)) {
        console.warn(`Model ${candidateModel} unavailable or rate-limited (429/404), trying next fallback model...`);
        continue;
      }
      throw new Error(formatUserFriendlyAiError(err));
    }
  }

  console.warn("All fallback models failed:", formatUserFriendlyAiError(lastErr));
  throw new Error(formatUserFriendlyAiError(lastErr));
}

async function sendChatMessageStreamForModel(
  ai: GoogleGenAI,
  actualModelName: string,
  baseContents: Content[],
  effectiveSystemInstruction: string,
  settings: AdvancedSettings,
  isGreetingTurn: boolean,
  allowEditorMutation: boolean,
  lastUserMessage: string,
  onChunk?: (text: string) => void
): Promise<{ text: string; functionCalls?: any[]; groundingMetadata?: any; emittedAny: boolean }> {
  let enrichedInstruction = effectiveSystemInstruction;
  let bridgeGrounding: any = null;

  const preCheckSelection = resolveToolSelectionForModel({
    modelId: actualModelName,
    enableEditorTools: settings.enableEditorTools,
    enableGoogleSearch: settings.enableGoogleSearch,
    isGreetingTurn,
    allowEditorMutation,
    lastUserMessage,
    declarations: buildChatDeclarations(allowEditorMutation),
  });

  if (
    settings.enableToolBridge !== false &&
    settings.enableGoogleSearch &&
    !isGreetingTurn &&
    !preCheckSelection.usedGoogleSearch &&
    hasWebSearchIntent(lastUserMessage)
  ) {
    const preSearch = await performClientWebSearchBridge(lastUserMessage);
    if (preSearch.results.length > 0) {
      bridgeGrounding = preSearch.groundingMetadata;
      enrichedInstruction += `\n\n--- نتائج البحث المباشر من الويب ---\n${JSON.stringify(preSearch.results, null, 2)}\nاستخدم هذه المعلومات والمصادر الموثوقة في إجابتك.`;
    }
  }

  const initial = buildCapabilityAwareChatRequest(
    actualModelName,
    baseContents,
    enrichedInstruction,
    settings,
    isGreetingTurn,
    allowEditorMutation,
    lastUserMessage
  );

  let activeContents: any[] = initial.preparedContents;
  let activeConfig: any = initial.config;

  let accumulatedText = "";
  let functionCalls: any[] = [];
  let groundingMetadata: any = bridgeGrounding;
  let streamParts: any[] = [];
  let isMaxTokens = false;
  let emittedAny = false;

  const runStream = async (currentContents: any[], emitChunk = true) => {
    for (let attempt = 0; attempt <= 3; attempt++) {
      let emittedInAttempt = false;
      try {
        isMaxTokens = false;
        const responseStream = await ai.models.generateContentStream({
          model: actualModelName,
          contents: currentContents,
          config: activeConfig
        });

        for await (const chunk of responseStream) {
          if (chunk.candidates?.[0]?.groundingMetadata) {
            groundingMetadata = chunk.candidates[0].groundingMetadata;
          }
          if (chunk.candidates?.[0]?.content?.parts) {
            streamParts.push(...chunk.candidates[0].content.parts);
          }
          if (chunk.text) {
            emittedInAttempt = true;
            accumulatedText += chunk.text;
            if (emitChunk && onChunk) {
              const visible = accumulatedText.replace(/<<<TOOL_CALL:[\s\S]*?(?:>>>|$)/g, '').trim();
              if (visible) {
                emittedAny = true;
                onChunk(visible);
              }
            }
          }
          if (chunk.functionCalls && chunk.functionCalls.length > 0) {
            emittedInAttempt = true;
            emittedAny = true;
            functionCalls.push(...chunk.functionCalls);
          }

          const finishReason = chunk.candidates?.[0]?.finishReason;
          if (finishReason === 'MAX_TOKENS') {
            isMaxTokens = true;
          }
        }
        return;
      } catch (err: any) {
        if (emittedInAttempt || !isUnsupportedCapabilityError(err)) {
          throw err;
        }
        const downgraded = downgradeConfigForUnsupportedError(
          currentContents,
          activeConfig,
          initial.modelSystemInstruction,
          attempt
        );
        if (!downgraded) throw err;
        console.warn(`Adjusting stream config for model ${actualModelName} compatibility (step ${attempt + 1}).`);
        currentContents = downgraded.contents;
        activeContents = downgraded.contents;
        activeConfig = downgraded.config;
        streamParts = [];
      }
    }
  };

  try {
    await runStream(activeContents, !initial.usingToolBridge);

    // Auto-continue if MAX_TOKENS reached (up to 5 times for very long text)
    let continuationCount = 0;
    while (isMaxTokens && functionCalls.length === 0 && continuationCount < 5) {
      continuationCount++;
      activeContents.push({
        role: 'model',
        parts: streamParts
      });
      activeContents.push({
        role: 'user',
        parts: [{ text: "أكمل من حيث توقفت تماماً وبدون أي مقدمات أو اعتذار لتكتمل السورة أو النص." }]
      });
      streamParts = [];
      await runStream(activeContents, !initial.usingToolBridge);
    }

    if (initial.usingToolBridge) {
      const parsedBridge = parseBridgeToolCalls(accumulatedText);
      accumulatedText = parsedBridge.cleanedText;
      let streamedSecondRound = false;

      if (parsedBridge.toolCalls.length > 0) {
        const bridgeDataOutputs: string[] = [];
        for (const bCall of parsedBridge.toolCalls) {
          if (bCall.name === 'update_editor_code' || bCall.name === 'run_editor_code') {
            if (allowEditorMutation) {
              functionCalls.push({ name: bCall.name, args: bCall.args });
            }
          } else if (bCall.name === 'web_search') {
            const searchRes = await performClientWebSearchBridge(String(bCall.args?.query || lastUserMessage));
            if (searchRes.groundingMetadata) groundingMetadata = searchRes.groundingMetadata;
            bridgeDataOutputs.push(`نتائج web_search:\n${JSON.stringify(searchRes.results)}`);
          } else {
            const toolOut = await executeServerSideToolCall(bCall);
            bridgeDataOutputs.push(`نتيجة ${bCall.name}:\n${toolOut}`);
          }
        }

        if (bridgeDataOutputs.length > 0) {
          activeContents = [
            ...activeContents,
            { role: 'model', parts: [{ text: parsedBridge.cleanedText || 'جاري جلب البيانات عبر الأداة...' }] },
            { role: 'user', parts: [{ text: `إليك البيانات الحقيقية المجلوبة من الأدوات:\n\n${bridgeDataOutputs.join('\n\n')}\n\nقدّم الإجابة النهائية الدقيقة والمفيدة للمستخدم الآن دون إخراج وسوم TOOL_CALL.` }] }
          ];
          accumulatedText = '';
          streamParts = [];
          streamedSecondRound = true;
          await runStream(activeContents, true);
          const secondParse = parseBridgeToolCalls(accumulatedText);
          accumulatedText = secondParse.cleanedText;
          for (const bCall of secondParse.toolCalls) {
            if ((bCall.name === 'update_editor_code' || bCall.name === 'run_editor_code') && allowEditorMutation) {
              functionCalls.push({ name: bCall.name, args: bCall.args });
            }
          }
        }
      }

      if (accumulatedText && !streamedSecondRound && onChunk) {
        emittedAny = true;
        onChunk(accumulatedText);
      }
    }

    const fetchTools = ["fetch_quran_surah", "fetch_quran_ayah", "fetch_hadith_data", "fetch_api_data", "fetch_quran_audio"];
    if (functionCalls.length > 0 && functionCalls.some(c => fetchTools.includes(c.name))) {
      const toolCall = functionCalls.find(c => fetchTools.includes(c.name))!;
      const fetchedContent = await executeServerSideToolCall(toolCall);

      if (streamParts.length > 0) {
        activeContents.push({
          role: 'model',
          parts: streamParts
        });
      } else {
        activeContents.push({
          role: 'model',
          parts: [{ functionCall: toolCall as any }]
        });
      }

      activeContents.push({
        role: 'user',
        parts: [{
          functionResponse: {
            ...(toolCall.id ? { id: toolCall.id } : {}),
            name: toolCall.name,
            response: { result: fetchedContent }
          }
        }]
      } as any);

      const secondStream = await ai.models.generateContentStream({
        model: actualModelName,
        contents: activeContents,
        config: activeConfig
      });

      for await (const chunk of secondStream) {
        if (chunk.candidates?.[0]?.groundingMetadata) {
          groundingMetadata = chunk.candidates[0].groundingMetadata;
        }
        if (chunk.text) {
          emittedAny = true;
          accumulatedText += chunk.text;
          if (onChunk) {
            onChunk(accumulatedText);
          }
        }
        if (chunk.functionCalls) {
          emittedAny = true;
          functionCalls.push(...chunk.functionCalls);
        }
      }
    }

    if (!accumulatedText.trim() && functionCalls.length === 0) {
      throw new Error('503 service unavailable: empty model response');
    }

    return { text: accumulatedText, functionCalls, groundingMetadata, emittedAny };
  } catch (err: any) {
    (err as any).__emittedAny = emittedAny;
    throw err;
  }
}

export async function sendChatMessageStream(
  messages: {role: string, content: string}[],
  systemInstruction: string,
  modelName: string = "gemini-2.5-flash",
  currentImagesBase64: string[] = [],
  settings: AdvancedSettings = DEFAULT_SETTINGS,
  onChunk?: (text: string) => void
): Promise<{text: string, functionCalls?: any[], groundingMetadata?: any}> {
  const ai = getClient();

  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  const isGreetingTurn = isPureGreetingOrSocial(lastUserMessage);
  const allowEditorMutation = !isGreetingTurn && hasCodeOrEditorIntent(lastUserMessage, currentImagesBase64.length > 0);

  const effectiveSystemInstruction = settings.systemPromptOverride && settings.systemPromptOverride.trim()
    ? `${settings.systemPromptOverride.trim()}\n\n--- التعليمات والسياق التقني التشغيلي ---\n${systemInstruction}`
    : systemInstruction;

  const baseContents: Content[] = messages
    .filter(msg => msg.content && msg.content.trim().length > 0)
    .map((msg, index, arr) => {
      const parts: any[] = [{ text: msg.content }];
      if (index === arr.length - 1 && msg.role === 'user' && currentImagesBase64.length > 0) {
         currentImagesBase64.forEach(img => {
           try {
             const mimeType = img.split(';')[0].split(':')[1];
             const data = img.split(',')[1];
             if (mimeType && data) {
               parts.push({ inlineData: { data, mimeType } });
             }
           } catch(e) {}
         });
      }

      return {
        role: msg.role === 'user' ? 'user' : 'model',
        parts
      };
    });

  const candidateModels = getModelSequence(modelName);
  let lastErr: any = null;

  for (const candidateModel of candidateModels) {
    try {
      const res = await sendChatMessageStreamForModel(
        ai,
        candidateModel,
        baseContents,
        effectiveSystemInstruction,
        settings,
        isGreetingTurn,
        allowEditorMutation,
        lastUserMessage,
        onChunk
      );
      return {
        text: res.text,
        functionCalls: res.functionCalls,
        groundingMetadata: res.groundingMetadata,
      };
    } catch (err: any) {
      lastErr = err;
      const emittedAny = Boolean(err?.__emittedAny);
      if (isQuotaOrRateLimitError(err)) {
        markModelRateLimited(candidateModel);
      }
      if (!emittedAny && isRetryableModelFallbackError(err)) {
        console.warn(`Stream model ${candidateModel} unavailable or rate-limited (429/404), trying next fallback model...`);
        continue;
      }
      // For non-retryable stream errors (e.g. transport hiccup) try direct non-stream fallback once on unthrottled models
      if (!isQuotaOrRateLimitError(err)) {
        try {
          return await sendChatMessage(messages, systemInstruction, candidateModel, currentImagesBase64, settings);
        } catch (directErr: any) {
          lastErr = directErr;
          if (!isRetryableModelFallbackError(directErr)) {
            throw directErr;
          }
          continue;
        }
      }
      throw new Error(formatUserFriendlyAiError(err));
    }
  }

  throw new Error(formatUserFriendlyAiError(lastErr));
}

export async function executePythonCode(code: string, modelName: string = "gemini-2.5-flash", timeoutMs: number = 45000): Promise<{ text: string, codeExecutionResult?: string, images?: string[] }> {
  const ai = getClient();
  const baseSequence = getModelSequence(modelName);
  const candidates = [
    ...baseSequence.filter(m => getModelCapabilities(m).supportsCodeExecution),
    ...baseSequence.filter(m => !getModelCapabilities(m).supportsCodeExecution),
  ];

  // To force Gemini to run the user's specific code, we tell it to execute exactly the code provided.
  const prompt = `Please execute the following Python code and return the output.\n\n\`\`\`python\n${code}\n\`\`\`\n\nIf the code generates visualizations or plots, ensure they are returned.`;

  let lastErr: any = null;
  for (const candidateModel of candidates) {
    const caps = getModelCapabilities(candidateModel);
    try {
      const config: any = {};
      if (caps.supportsSamplingParams) {
        config.temperature = 0;
      }
      if (caps.supportsCodeExecution) {
        config.tools = [{ codeExecution: {} }];
      }

      const timeoutPromise = new Promise<any>((_, reject) => {
        setTimeout(() => reject(new Error("انتهى الوقت المحدد لتشغيل الكود (Timeout). قد يحتوي الكود على حلقة لا نهائية (Infinite Loop) أو يستغرق وقتاً أطول من المسموح به.")), timeoutMs);
      });

      let response: any;
      try {
        response = await Promise.race([
          ai.models.generateContent({ model: candidateModel, contents: prompt, config }),
          timeoutPromise
        ]);
      } catch (err: any) {
        if (config.tools && isUnsupportedCapabilityError(err)) {
          const fallbackConfig = { ...config };
          delete fallbackConfig.tools;
          response = await Promise.race([
            ai.models.generateContent({ model: candidateModel, contents: prompt, config: fallbackConfig }),
            timeoutPromise
          ]);
        } else {
          throw err;
        }
      }

      let text = "";
      try {
        text = response.text || "";
      } catch(e) {}

      let codeExecutionResult = "";
      const images: string[] = [];
      const parts = response.candidates?.[0]?.content?.parts || [];

      for (const part of parts) {
        if (part.inlineData) {
          images.push(`data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`);
        }

        if ((part as any).executableCode) {
          const codeData = (part as any).executableCode.code;
          codeExecutionResult += `### الشفرة المنفذة:\n\`\`\`python\n${codeData}\n\`\`\`\n\n`;
        }
        if ((part as any).codeExecutionResult) {
          const res = (part as any).codeExecutionResult;
          codeExecutionResult += `### نتيجة التنفيذ (${res.outcome}):\n\`\`\`text\n${res.output}\n\`\`\`\n\n`;
        }
      }

      return { text, codeExecutionResult, images };
    } catch (error: any) {
      lastErr = error;
      if (isQuotaOrRateLimitError(error)) {
        markModelRateLimited(candidateModel);
      }
      if (isRetryableModelFallbackError(error)) {
        console.warn(`Code execution model ${candidateModel} unavailable/rate-limited, trying next fallback model...`);
        continue;
      }
      throw error;
    }
  }

  console.warn("Code execution failed across all fallback models:", formatUserFriendlyAiError(lastErr));
  throw new Error(formatUserFriendlyAiError(lastErr));
}

export interface DebugAnalysisResult {
  errorSummary: string;
  explanation: string;
  suggestions: string[];
  fixedCode: string;
}

export async function explainAndFixCodeError(
  code: string,
  errorText: string,
  modelName: string = "gemini-2.5-flash"
): Promise<DebugAnalysisResult> {
  const ai = getClient();
  const candidates = getModelSequence(modelName);

  const prompt = `أنت خبير تصحيح وتنقيح البرامج (Python Debugger) ومساعد ذكي.
تلقيت كود بايثون يحتوي على خطأ أثناء التنفيذ، مع نص الخطأ التالي.

الكود البرمجي:
\`\`\`python
${code}
\`\`\`

نص الخطأ الناتج:
\`\`\`text
${errorText}
\`\`\`

تنبيه هام جداً حول البيئة (Sandbox environment constraint):
بيئة تشغيل بايثون هي بيئة معزولة داخل المتصفح (Pyodide) ولا تملك إمكانية الاتصال بالشبكة الخارجية مباشرة (Network connection disabled). لذلك استخدام urllib.request أو requests يسبب خطأ "Temporary failure in name resolution" أو "URLError".
إذا كان سبب الخطأ هو الاتصال بالشبكة (urllib / requests / name resolution):
يجب عليك في "fixedCode" إزالة الاتصال بالشبكة نهائياً، وتضمين البيانات (JSON / Dictionary / string) مباشرة داخل متغير في كود بايثون (Hardcoded / Inline data) ليتم تشغيل الكود ومعالجته ورسم المخططات البيانية فوراً بدون أخطاء!

قم بتحليل الخطأ وتقديم الشرح والتعديلات اللازمة. يجب أن تكون إجابتك بتنسيق JSON حصراً بالكائن التالي بدون أي كلام خارج كود JSON:
{
  "errorSummary": "عنوان وافي ومبسط لنوع الخطأ باللغة العربية",
  "explanation": "شرح واضح وسهل ومبسط لسبب المشكلة باللغة العربية",
  "suggestions": [
    "النصيحة أو خطوة التعديل الأولى",
    "النصيحة أو خطوة التعديل الثانية"
  ],
  "fixedCode": "الكود الكامل المحدث والمصحح الجاهز للتشغيل مباشرة بدون أخطاء"
}`;

  try {
    let lastErr: any = null;
    for (const candidateModel of candidates) {
      const caps = getModelCapabilities(candidateModel);
      try {
        const config: any = {};
        if (caps.supportsSamplingParams) {
          config.temperature = 0.2;
        }
        if (caps.supportsStructuredJsonOutput) {
          config.responseMimeType = "application/json";
          config.responseSchema = {
            type: Type.OBJECT,
            properties: {
              errorSummary: { type: Type.STRING },
              explanation: { type: Type.STRING },
              suggestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              fixedCode: { type: Type.STRING }
            },
            required: ["errorSummary", "explanation", "suggestions", "fixedCode"]
          };
        }

        let response: any;
        try {
          response = await ai.models.generateContent({
            model: candidateModel,
            contents: prompt,
            config
          });
        } catch (err: any) {
          if (config.responseSchema && isUnsupportedCapabilityError(err)) {
            const plainConfig: any = caps.supportsSamplingParams ? { temperature: 0.2 } : {};
            response = await ai.models.generateContent({
              model: candidateModel,
              contents: prompt,
              config: plainConfig
            });
          } else {
            throw err;
          }
        }

        const rawText = (response.text || "").trim();
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
        return {
          errorSummary: parsed.errorSummary || "خطأ غير محدد أثناء تشغيل البرنامج",
          explanation: parsed.explanation || "حدث خطأ غير متوقع أثناء معالجة الكود.",
          suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : ["تحقق من المدخلات وأسماء المتغيرات"],
          fixedCode: parsed.fixedCode || code
        };
      } catch (err: any) {
        lastErr = err;
        if (isQuotaOrRateLimitError(err)) {
          markModelRateLimited(candidateModel);
        }
        if (isRetryableModelFallbackError(err)) {
          continue;
        }
        throw err;
      }
    }
    throw lastErr || new Error("تعذر الاتصال بالنماذج المتاحة.");
  } catch (err) {
    console.warn("Debug analysis warning:", formatUserFriendlyAiError(err));
    return {
      errorSummary: "خطأ في تنفيذ السكريبت",
      explanation: formatUserFriendlyAiError(err),
      suggestions: ["تأكد من صحة بناء الجملة (Syntax)", "تحقق من تعريف كافة المتغيرات والمكتبات المستوردة"],
      fixedCode: code
    };
  }
}

