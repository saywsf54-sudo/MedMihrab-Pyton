import { GoogleGenAI, Content, Type } from "@google/genai";
import { fetchSurahFromApi, fetchAyahFromApi, fetchHadithFromApi, fetchQuranAudioFromApi } from "./quranApiService";

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
  // Invalidate cached client to force re-instantiation with new key
  aiClient = null;
  currentClientApiKey = null;
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

export function resolveActualModelId(modelId: string): string {
  if (!modelId || typeof modelId !== 'string') return 'gemini-3.6-flash';
  const clean = modelId.trim().replace(/^models\//, '');
  if (clean === 'gemini-3.1-pro-preview-customtools') {
    return 'gemini-3.1-pro-preview';
  }
  return clean;
}

export const FALLBACK_MODELS_CHAIN = [
  'gemini-robotics-er-2-preview',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview'
];

export function getModelSequence(primaryModel?: string): string[] {
  const cleanPrimary = resolveActualModelId(primaryModel || 'gemini-3.6-flash');
  const sequence = [cleanPrimary];
  for (const fb of FALLBACK_MODELS_CHAIN) {
    const cleanFb = resolveActualModelId(fb);
    if (!sequence.includes(cleanFb)) {
      sequence.push(cleanFb);
    }
  }
  return sequence;
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
    const modelsToTry = getModelSequence(preferredModel || 'gemini-3.6-flash');
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

export async function generateSmartPersona(userHint: string, modelName: string = "gemini-3.6-flash"): Promise<string> {
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
    const actualModel = resolveActualModelId(modelName);
    const res = await ai.models.generateContent({
      model: actualModel,
      contents: prompt,
      config: { temperature: 0.8 }
    });
    return res.text?.trim() || AGENT_PRESETS[0].systemPrompt;
  } catch (err) {
    console.warn("Error generating smart persona:", err);
    if (userHint && userHint.trim()) {
      return `أنت خبير ومساعد متخصص في (${userHint.trim()}). تقوم بكتابة وتطوير أكواد بايثون عالية الجودة، وتحديث المحرر بـ update_editor_code وتشغيلها، وتجهيز رسوم بيانية وتتبع النتائج بدقة.`;
    }
    return AGENT_PRESETS[0].systemPrompt;
  }
}

export const DEFAULT_ALL_MODELS: ModelOption[] = [
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (الأحدث والأسرع ✨)' },
  { id: 'gemini-robotics-er-2-preview', name: 'Gemini Robotics ER-2 (خيار التراجع الأول 🤖)' },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite (خيار التراجع الثاني ⚡)' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash (خيار التراجع الثالث 🌟)' },
  { id: 'gemini-3.1-pro-preview-customtools', name: 'Gemini 3.1 Pro (أدوات مخصصة)' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (الأقوى - متطور)' },
  { id: 'gemma-3-27b-it', name: 'Gemma 3 27B IT (نموذج جوما 3 المتقدم 🚀)' },
  { id: 'gemma-3-12b-it', name: 'Gemma 3 12B IT (نموذج جوما 3)' },
  { id: 'gemma-3-4b-it', name: 'Gemma 3 4B IT (نموذج جوما 3 خفيف)' },
  { id: 'gemma-3-1b-it', name: 'Gemma 3 1B IT (نموذج جوما 3 فائق السرعة)' },
  { id: 'gemma-2-27b-it', name: 'Gemma 2 27B IT' },
  { id: 'gemma-2-9b-it', name: 'Gemma 2 9B IT' }
];

export async function fetchAvailableModels(): Promise<ModelOption[]> {
  const uniqueMap = new Map<string, ModelOption>();

  // Add default Gemini & Gemma models first
  DEFAULT_ALL_MODELS.forEach(m => uniqueMap.set(m.id, m));

  try {
    const ai = getClient();
    const response = await ai.models.list();

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
      const validModels = modelsList.filter(m => {
        const nameLower = (m.name || m.id || '').toLowerCase();
        const isGeminiOrGemma = nameLower.includes('gemini') || nameLower.includes('gemma') || nameLower.includes('gema');
        const supportsGenerate = m.supportedGenerationMethods ? m.supportedGenerationMethods.includes('generateContent') : true;
        return isGeminiOrGemma && supportsGenerate;
      });

      for (const m of validModels) {
        let cleanId = (m.name || m.id || '').replace(/^models\//, '');
        if (!cleanId) continue;
        
        let displayName = m.displayName || cleanId;
        if (cleanId.includes('gemma') || cleanId.includes('gema')) {
          displayName = `Gemma (${cleanId})`;
        } else if (cleanId.includes('3.6')) {
          displayName += ' (أحدث إصدار ✨)';
        } else if (cleanId.includes('3.1-pro')) {
          displayName += ' (متطور جداً)';
        } else if (cleanId.includes('flash')) {
          displayName += ' (سريع)';
        } else if (cleanId.includes('pro')) {
          displayName += ' (احترافي)';
        }

        uniqueMap.set(cleanId, {
          id: cleanId,
          name: displayName
        });
      }
    }
  } catch (err) {
    console.warn("Could not fetch models automatically, using comprehensive default list:", err);
  }

  // Ensure customtools is present for user workflow
  if (!uniqueMap.has('gemini-3.1-pro-preview-customtools')) {
    uniqueMap.set('gemini-3.1-pro-preview-customtools', { id: 'gemini-3.1-pro-preview-customtools', name: 'Gemini 3.1 Pro (أدوات مخصصة)' });
  }

  return Array.from(uniqueMap.values());
}

export async function sendChatMessage(
  messages: {role: string, content: string}[],
  systemInstruction: string,
  modelName: string = "gemini-3.6-flash",
  currentImagesBase64: string[] = [],
  settings: AdvancedSettings = DEFAULT_SETTINGS
): Promise<{text: string, functionCalls?: any[], groundingMetadata?: any}> {
  const ai = getClient();
  const actualModelName = resolveActualModelId(modelName);
  const isGemma = actualModelName.includes('gemma');

  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  const isGreetingTurn = isPureGreetingOrSocial(lastUserMessage);
  const allowEditorMutation = !isGreetingTurn && hasCodeOrEditorIntent(lastUserMessage, currentImagesBase64.length > 0);

  const toolsConfig: any[] = [];
  
  if (settings.enableEditorTools && !isGemma && !isGreetingTurn) {
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

    toolsConfig.push({
      functionDeclarations: declarations
    });
  }

  if (settings.enableGoogleSearch && !isGreetingTurn) {
    toolsConfig.push({ googleSearch: {} });
  }

  const effectiveSystemInstruction = settings.systemPromptOverride && settings.systemPromptOverride.trim()
    ? `${settings.systemPromptOverride.trim()}\n\n--- التعليمات والسياق التقني التشغيلي ---\n${systemInstruction}`
    : systemInstruction;

  const contents: Content[] = messages
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

  try {
    const config: any = {
      systemInstruction: effectiveSystemInstruction,
      temperature: settings.temperature ?? 0.7,
      topP: settings.topP ?? 0.95,
      topK: settings.topK ?? 40,
      maxOutputTokens: settings.maxOutputTokens ?? 65536,
    };

    if (toolsConfig.length > 0) {
      config.tools = toolsConfig;
      config.toolConfig = { includeServerSideToolInvocations: true };
    }

    let response = await ai.models.generateContent({
      model: actualModelName,
      contents,
      config
    });

    let text = "";
    try { text = response.text || ""; } catch(e) {}

    let groundingMetadata = response.candidates?.[0]?.groundingMetadata;

    // Handle server-side data fetching tools internally
    const fetchTools = ["fetch_quran_surah", "fetch_quran_ayah", "fetch_hadith_data", "fetch_api_data"];
    let loopCount = 0;

    while (loopCount < 3) {
      let functionCalls = response.functionCalls;
      if (!functionCalls || !functionCalls.some(c => fetchTools.includes(c.name || ''))) {
        break;
      }

      const toolCall = functionCalls.find(c => fetchTools.includes(c.name || ''))!;
      const fetchedContent = await executeServerSideToolCall(toolCall);

      const modelContent = response.candidates?.[0]?.content;
      if (modelContent) {
        contents.push(modelContent);
      } else {
        contents.push({
          role: 'model',
          parts: [{ functionCall: toolCall as any }]
        });
      }

      contents.push({
        role: 'user',
        parts: [{
          functionResponse: {
            name: toolCall.name,
            response: { result: fetchedContent }
          }
        }]
      } as any);

      response = await ai.models.generateContent({
        model: actualModelName,
        contents,
        config
      });

      try { text = response.text || ""; } catch(e) {}
      if (response.candidates?.[0]?.groundingMetadata) {
        groundingMetadata = response.candidates[0].groundingMetadata;
      }
      loopCount++;
    }

    return { text, functionCalls: response.functionCalls, groundingMetadata };
  } catch (err: any) {
    console.error("Chat message error:", err);
    let errMsg = typeof err === 'string' ? err : (err.message || JSON.stringify(err));
    if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("لقد استنفدت الحصة المخصصة (Quota) لمفتاح API الخاص بك (خطأ 429). الرجاء المحاولة بعد قليل أو الترقية لنموذج أخف مثل Flash.");
    }
    if (errMsg.includes("thought signature") || errMsg.includes("Function call")) {
      throw new Error("حدث تعارض في توقيع أداة الذكاء الاصطناعي. يمكنك جلب النصوص القرآنية والحديثية مباشرة عبر زر الجلب الذكي السريع بجانب إرفاق الملفات.");
    }
    throw new Error(err.message || "فشل الاتصال بالذكاء الاصطناعي بسبب خطأ في الخادم أو أن الطلب طويل جداً.");
  }
}

export async function sendChatMessageStream(
  messages: {role: string, content: string}[],
  systemInstruction: string,
  modelName: string = "gemini-3.6-flash",
  currentImagesBase64: string[] = [],
  settings: AdvancedSettings = DEFAULT_SETTINGS,
  onChunk?: (text: string) => void
): Promise<{text: string, functionCalls?: any[], groundingMetadata?: any}> {
  const ai = getClient();
  const actualModelName = resolveActualModelId(modelName);
  const isGemma = actualModelName.includes('gemma');

  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  const isGreetingTurn = isPureGreetingOrSocial(lastUserMessage);
  const allowEditorMutation = !isGreetingTurn && hasCodeOrEditorIntent(lastUserMessage, currentImagesBase64.length > 0);

  const toolsConfig: any[] = [];
  if (settings.enableEditorTools && !isGemma && !isGreetingTurn) {
    const declarations: any[] = [
      {
        name: "fetch_quran_audio",
        description: "Fetches recitation audio streams, reciter info, and ayah audio URLs for any Surah or Ayah in the Quran with support for all major reciters.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            surahIdentifier: { type: Type.STRING, description: "Surah number (1-114) or Surah name" },
            reciter: { type: Type.STRING, description: "Reciter ID" },
            ayahNumber: { type: Type.NUMBER, description: "Optional Ayah number" }
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

    toolsConfig.push({
      functionDeclarations: declarations
    });
  }

  if (settings.enableGoogleSearch && !isGreetingTurn) {
    toolsConfig.push({ googleSearch: {} });
  }

  const effectiveSystemInstruction = settings.systemPromptOverride && settings.systemPromptOverride.trim()
    ? `${settings.systemPromptOverride.trim()}\n\n--- التعليمات والسياق التقني التشغيلي ---\n${systemInstruction}`
    : systemInstruction;

  const contents: Content[] = messages
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

  const config: any = {
    systemInstruction: effectiveSystemInstruction,
    temperature: settings.temperature ?? 0.7,
    topP: settings.topP ?? 0.95,
    topK: settings.topK ?? 40,
    maxOutputTokens: settings.maxOutputTokens ?? 65536,
  };

  if (toolsConfig.length > 0) {
    config.tools = toolsConfig;
    config.toolConfig = { includeServerSideToolInvocations: true };
  }

  try {
    let accumulatedText = "";
    let functionCalls: any[] = [];
    let groundingMetadata: any = null;
    let streamParts: any[] = [];
    let isMaxTokens = false;

    const runStream = async (currentContents: any[]) => {
      isMaxTokens = false;
      const responseStream = await ai.models.generateContentStream({
        model: actualModelName,
        contents: currentContents,
        config
      });

      for await (const chunk of responseStream) {
        if (chunk.candidates?.[0]?.groundingMetadata) {
          groundingMetadata = chunk.candidates[0].groundingMetadata;
        }
        if (chunk.candidates?.[0]?.content?.parts) {
          streamParts.push(...chunk.candidates[0].content.parts);
        }
        if (chunk.text) {
          accumulatedText += chunk.text;
          if (onChunk) {
            onChunk(accumulatedText);
          }
        }
        if (chunk.functionCalls && chunk.functionCalls.length > 0) {
          functionCalls.push(...chunk.functionCalls);
        }
        
        const finishReason = chunk.candidates?.[0]?.finishReason;
        if (finishReason === 'MAX_TOKENS') {
          isMaxTokens = true;
        }
      }
    };

    await runStream(contents);
    
    // Auto-continue if MAX_TOKENS reached (up to 5 times for very long text)
    let continuationCount = 0;
    while (isMaxTokens && functionCalls.length === 0 && continuationCount < 5) {
      continuationCount++;
      contents.push({
        role: 'model',
        parts: streamParts
      });
      contents.push({
        role: 'user',
        parts: [{ text: "أكمل من حيث توقفت تماماً وبدون أي مقدمات أو اعتذار لتكتمل السورة أو النص." }]
      });
      streamParts = []; // Reset for the next stream
      await runStream(contents);
    }

    const fetchTools = ["fetch_quran_surah", "fetch_quran_ayah", "fetch_hadith_data", "fetch_api_data", "fetch_quran_audio"];
    if (functionCalls.length > 0 && functionCalls.some(c => fetchTools.includes(c.name))) {
      const toolCall = functionCalls.find(c => fetchTools.includes(c.name))!;
      const fetchedContent = await executeServerSideToolCall(toolCall);

      if (streamParts.length > 0) {
        contents.push({
          role: 'model',
          parts: streamParts
        });
      } else {
        contents.push({
          role: 'model',
          parts: [{ functionCall: toolCall as any }]
        });
      }

      contents.push({
        role: 'user',
        parts: [{
          functionResponse: {
            name: toolCall.name,
            response: { result: fetchedContent }
          }
        }]
      } as any);

      const secondStream = await ai.models.generateContentStream({
        model: actualModelName,
        contents,
        config
      });

      for await (const chunk of secondStream) {
        if (chunk.candidates?.[0]?.groundingMetadata) {
          groundingMetadata = chunk.candidates[0].groundingMetadata;
        }
        if (chunk.text) {
          accumulatedText += chunk.text;
          if (onChunk) {
            onChunk(accumulatedText);
          }
        }
        if (chunk.functionCalls) {
          functionCalls.push(...chunk.functionCalls);
        }
      }
    }

    return { text: accumulatedText, functionCalls, groundingMetadata };
  } catch (err: any) {
    console.warn("Chat streaming failed, using direct response:", err);
    return sendChatMessage(messages, systemInstruction, modelName, currentImagesBase64, settings);
  }
}

export async function executePythonCode(code: string, modelName: string = "gemini-3.6-flash", timeoutMs: number = 45000): Promise<{ text: string, codeExecutionResult?: string, images?: string[] }> {
  const ai = getClient();
  const actualModelName = resolveActualModelId(modelName);
  const isGemma = actualModelName.includes('gemma');

  // To force Gemini to run the user's specific code, we tell it to execute exactly the code provided.
  const prompt = `Please execute the following Python code and return the output.\n\n\`\`\`python\n${code}\n\`\`\`\n\nIf the code generates visualizations or plots, ensure they are returned.`;

  try {
    const config: any = {
      temperature: 0,
    };
    if (!isGemma) {
      config.tools = [{ codeExecution: {} }];
    }

    const generateContentPromise = ai.models.generateContent({
      model: actualModelName,
      contents: prompt,
      config
    });

    const timeoutPromise = new Promise<any>((_, reject) => {
      setTimeout(() => reject(new Error("انتهى الوقت المحدد لتشغيل الكود (Timeout). قد يحتوي الكود على حلقة لا نهائية (Infinite Loop) أو يستغرق وقتاً أطول من المسموح به.")), timeoutMs);
    });

    const response = await Promise.race([generateContentPromise, timeoutPromise]);


    let text = "";
    try {
      text = response.text || "";
    } catch(e) {
      // text getter throws if there's no text part
    }
    
    // Extract execution results from the parts if available
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
    console.error("Code execution error:", error);
    let errMsg = typeof error === 'string' ? error : (error.message || JSON.stringify(error));
    if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("لقد استنفدت الحصة المخصصة (Quota) لمفتاح API الخاص بك (خطأ 429). يرجى الترقية أو استخدام نموذج آخر (مثل 2.5 Flash أو Lite بدلاً من Pro) لتخفيف الضغط على الكوتا.");
    }
    throw error;
  }
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
  modelName: string = "gemini-3.6-flash"
): Promise<DebugAnalysisResult> {
  const ai = getClient();
  const actualModel = resolveActualModelId(modelName);

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
    const response = await ai.models.generateContent({
      model: actualModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
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
        },
        temperature: 0.2
      }
    });

    const rawText = response.text || "";
    const parsed = JSON.parse(rawText);
    return {
      errorSummary: parsed.errorSummary || "خطأ غير محدد أثناء تشغيل البرنامج",
      explanation: parsed.explanation || "حدث خطأ غير متوقع أثناء معالجة الكود.",
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : ["تحقق من المدخلات وأسماء المتغيرات"],
      fixedCode: parsed.fixedCode || code
    };
  } catch (err) {
    console.error("Debug analysis error:", err);
    // Fallback if JSON schema parsing fails
    return {
      errorSummary: "خطأ في تنفيذ السكريبت",
      explanation: typeof err === 'string' ? err : ((err as any)?.message || "تعذر إكمال التحليل الآلي للخطأ."),
      suggestions: ["تأكد من صحة بناء الجملة (Syntax)", "تحقق من تعريف كافة المتغيرات والمكتبات المستوردة"],
      fixedCode: code
    };
  }
}

