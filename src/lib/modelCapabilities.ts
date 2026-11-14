export type ModelFamily =
  | 'gemma'
  | 'gemini-4'
  | 'gemini-3'
  | 'gemini-robotics'
  | 'gemini-2.5'
  | 'gemini-2.0'
  | 'gemini-legacy'
  | 'specialized';

export interface ModelCapabilities {
  modelId: string;
  family: ModelFamily;
  supportsSystemInstruction: boolean;
  supportsFunctionCalling: boolean;
  supportsGoogleSearch: boolean;
  supportsHybridTools: boolean;
  supportsIncludeServerSideToolInvocations: boolean;
  supportsCodeExecution: boolean;
  supportsStructuredJsonOutput: boolean;
  supportsSamplingParams: boolean;
  summaryAr: string;
}

export function resolveActualModelId(modelId: string): string {
  if (!modelId || typeof modelId !== 'string') return 'gemini-2.5-flash';
  const clean = modelId.trim().replace(/^models\//, '');
  return clean || 'gemini-2.5-flash';
}

export function extractSearchKeywords(rawQuery: string): string {
  const cleaned = (rawQuery || '')
    .replace(/(?:من فضلك|لو سمحت|رجاءً?|أرجوك)/gi, ' ')
    .replace(/(?:ابحث لي عن|ابحث في الويب عن|ابحث في الانترنت عن|ابحث في الإنترنت عن|ابحث في جوجل عن|ابحث عن|بحث عن|أخبرني عن|واخبرني|وأخبرني|ما هو|ما هي|من هو|من هي|كم عدد|search for|search the web for|google)\s*/gi, ' ')
    .replace(/[؟?!.,،؛:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || (rawQuery || '').trim();
}

export function getModelCapabilities(modelId: string): ModelCapabilities {
  const actual = resolveActualModelId(modelId);
  const lower = actual.toLowerCase();

  // 1. Specialized non-chat modalities (TTS, Image generation, Audio Live/Transcribe, Embeddings, Video, Music)
  if (
    lower.includes('-tts') ||
    lower.includes('-image') ||
    lower.includes('nano-banana') ||
    lower.includes('transcribe') ||
    lower.includes('embedding') ||
    lower.includes('lyria') ||
    lower.includes('omni') ||
    lower.includes('live-translate') ||
    lower.includes('-live') ||
    lower.includes('antigravity') ||
    lower.includes('deep-research')
  ) {
    return {
      modelId: actual,
      family: 'specialized',
      supportsSystemInstruction: false,
      supportsFunctionCalling: false,
      supportsGoogleSearch: false,
      supportsHybridTools: false,
      supportsIncludeServerSideToolInvocations: false,
      supportsCodeExecution: false,
      supportsStructuredJsonOutput: false,
      supportsSamplingParams: false,
      summaryAr: 'نموذج متخصص لوسائط محددة؛ تُعطَّل أدوات البحث والبرمجة تلقائياً.',
    };
  }

  // 2. Gemma open-weights models (no tools, no Google Search, no developer systemInstruction, no JSON schema)
  if (lower.includes('gemma') || lower.includes('gema')) {
    return {
      modelId: actual,
      family: 'gemma',
      supportsSystemInstruction: false,
      supportsFunctionCalling: false,
      supportsGoogleSearch: false,
      supportsHybridTools: false,
      supportsIncludeServerSideToolInvocations: false,
      supportsCodeExecution: false,
      supportsStructuredJsonOutput: false,
      supportsSamplingParams: true,
      summaryAr: 'نماذج Gemma لا تدعم الأدوات أو بحث Google أو systemInstruction؛ يتم تمرير التوجيه داخل الرسالة وتشغيلها كنموذج نصي خالص تلقائياً.',
    };
  }

  // 3. Gemini Robotics ER models (supports function calling or standalone search, NOT hybrid tool mixing or includeServerSideToolInvocations)
  if (lower.includes('robotics')) {
    return {
      modelId: actual,
      family: 'gemini-robotics',
      supportsSystemInstruction: true,
      supportsFunctionCalling: true,
      supportsGoogleSearch: true,
      supportsHybridTools: false,
      supportsIncludeServerSideToolInvocations: false,
      supportsCodeExecution: true,
      supportsStructuredJsonOutput: true,
      supportsSamplingParams: true,
      summaryAr: 'نموذج Robotics ER: لا يدعم دمج أدوات المحرر مع بحث Google أو includeServerSideToolInvocations؛ يختار التطبيق الأداة الأنسب تلقائياً دون دمج.',
    };
  }

  // 4. Gemini 4 series (full hybrid tools + includeServerSideToolInvocations; deprecated sampling params omitted)
  if (/gemini-4(?:\b|-|\.)/.test(lower)) {
    return {
      modelId: actual,
      family: 'gemini-4',
      supportsSystemInstruction: true,
      supportsFunctionCalling: true,
      supportsGoogleSearch: true,
      supportsHybridTools: true,
      supportsIncludeServerSideToolInvocations: true,
      supportsCodeExecution: true,
      supportsStructuredJsonOutput: true,
      supportsSamplingParams: false,
      summaryAr: 'يدعم Gemini 4 دمج الأدوات المخصصة مع بحث Google وتفعيل includeServerSideToolInvocations تلقائياً (مع إدارة الحرارة داخلياً).',
    };
  }

  // 5. Gemini 3 series (full hybrid tools + includeServerSideToolInvocations)
  if (/gemini-3(?:\b|-|\.)/.test(lower)) {
    return {
      modelId: actual,
      family: 'gemini-3',
      supportsSystemInstruction: true,
      supportsFunctionCalling: true,
      supportsGoogleSearch: true,
      supportsHybridTools: true,
      supportsIncludeServerSideToolInvocations: true,
      supportsCodeExecution: true,
      supportsStructuredJsonOutput: true,
      supportsSamplingParams: true,
      summaryAr: 'يدعم Gemini 3 دمج الأدوات المخصصة مع بحث Google وتفعيل includeServerSideToolInvocations تلقائياً.',
    };
  }

  // 6. Gemini 2.5 series (supports tools OR search separately, NOT hybrid mixing / includeServerSideToolInvocations)
  if (/gemini-2\.5(?:\b|-)/.test(lower)) {
    return {
      modelId: actual,
      family: 'gemini-2.5',
      supportsSystemInstruction: true,
      supportsFunctionCalling: true,
      supportsGoogleSearch: true,
      supportsHybridTools: false,
      supportsIncludeServerSideToolInvocations: false,
      supportsCodeExecution: true,
      supportsStructuredJsonOutput: true,
      supportsSamplingParams: true,
      summaryAr: 'يدعم Gemini 2.5 الأدوات وبحث Google بشكل منفصل فقط (لا يدعم دمجهما معاً أو includeServerSideToolInvocations)؛ يتم الفصل تلقائياً حسب الطلب.',
    };
  }

  // 7. Gemini 2.0 series (non-hybrid)
  if (/gemini-2\.0(?:\b|-)/.test(lower)) {
    return {
      modelId: actual,
      family: 'gemini-2.0',
      supportsSystemInstruction: true,
      supportsFunctionCalling: true,
      supportsGoogleSearch: true,
      supportsHybridTools: false,
      supportsIncludeServerSideToolInvocations: false,
      supportsCodeExecution: true,
      supportsStructuredJsonOutput: true,
      supportsSamplingParams: true,
      summaryAr: 'يدعم Gemini 2.0 الأدوات وبحث Google بشكل منفصل فقط دون دمج أو includeServerSideToolInvocations.',
    };
  }

  // 8. Legacy / unknown Gemini models (safe conservative defaults: no hybrid tool mixing or includeServerSideToolInvocations)
  return {
    modelId: actual,
    family: 'gemini-legacy',
    supportsSystemInstruction: true,
    supportsFunctionCalling: true,
    supportsGoogleSearch: true,
    supportsHybridTools: false,
    supportsIncludeServerSideToolInvocations: false,
    supportsCodeExecution: true,
    supportsStructuredJsonOutput: true,
    supportsSamplingParams: true,
    summaryAr: 'إعدادات متوافقة تلقائياً: بدون دمج الأدوات المخصصة مع بحث Google أو تفعيل includeServerSideToolInvocations.',
  };
}

export function foldSystemInstructionIntoContents(
  contents: any[],
  systemInstruction: string
): any[] {
  const sys = (systemInstruction || '').trim();
  if (!sys || !Array.isArray(contents) || contents.length === 0) {
    return contents;
  }

  const cloned = contents.map((item) => ({
    ...item,
    parts: Array.isArray(item.parts) ? [...item.parts] : [],
  }));

  const firstUserIdx = cloned.findIndex((item) => item.role === 'user');
  const instructionBlock = `تعليمات النظام والمنصة:\n${sys}\n\n---\nرسالة المستخدم:`;

  if (firstUserIdx >= 0) {
    cloned[firstUserIdx].parts = [{ text: instructionBlock }, ...cloned[firstUserIdx].parts];
  } else {
    cloned.unshift({ role: 'user', parts: [{ text: instructionBlock }] });
  }

  return cloned;
}

export function isUnsupportedCapabilityError(err: any): boolean {
  const msg = (typeof err === 'string' ? err : err?.message || JSON.stringify(err || '')).toLowerCase();
  return (
    msg.includes('includeserversidetoolinvocations') ||
    msg.includes('include_server_side_tool_invocations') ||
    msg.includes('tool use with function calling is unsupported') ||
    msg.includes('built-in tools with function calling') ||
    msg.includes('function calling is not supported') ||
    msg.includes('function_declarations') ||
    msg.includes('function declarations') ||
    msg.includes('google_search') ||
    msg.includes('search grounding') ||
    msg.includes('developer instruction is not enabled') ||
    msg.includes('not enabled for models/') ||
    msg.includes('systeminstruction') ||
    msg.includes('system_instruction') ||
    msg.includes('tools is not supported') ||
    msg.includes('tool_config') ||
    msg.includes('toolconfig') ||
    msg.includes('code_execution') ||
    msg.includes('codeexecution') ||
    msg.includes('unknown name "includeserversidetoolinvocations"') ||
    msg.includes('json mode is not enabled') ||
    msg.includes('response_schema')
  );
}

export function downgradeConfigForUnsupportedError(
  currentContents: any[],
  currentConfig: any,
  effectiveSystemInstruction: string,
  attemptIndex: number
): { contents: any[]; config: any } | null {
  const nextConfig = { ...currentConfig };
  const nextContents = currentContents;

  if (attemptIndex === 0) {
    if (nextConfig.toolConfig) {
      delete nextConfig.toolConfig;
    }
    if (Array.isArray(nextConfig.tools) && nextConfig.tools.length > 1) {
      const fnOnly = nextConfig.tools.filter((t: any) => Boolean(t.functionDeclarations));
      if (fnOnly.length > 0) {
        nextConfig.tools = fnOnly;
      } else {
        delete nextConfig.tools;
      }
    } else if (nextConfig.tools) {
      delete nextConfig.tools;
    }
    return { contents: nextContents, config: nextConfig };
  }

  if (attemptIndex === 1) {
    delete nextConfig.toolConfig;
    delete nextConfig.tools;
    return { contents: nextContents, config: nextConfig };
  }

  if (attemptIndex === 2 && nextConfig.systemInstruction) {
    delete nextConfig.toolConfig;
    delete nextConfig.tools;
    delete nextConfig.systemInstruction;
    return {
      contents: foldSystemInstructionIntoContents(currentContents, effectiveSystemInstruction),
      config: nextConfig,
    };
  }

  return null;
}

const modelRateLimitUntil = new Map<string, number>();

export function isQuotaOrRateLimitError(err: any): boolean {
  const msg = (typeof err === 'string' ? err : err?.message || JSON.stringify(err || '')).toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('rate-limit') ||
    msg.includes('too many requests')
  );
}

export function isModelUnavailableError(err: any): boolean {
  const msg = (typeof err === 'string' ? err : err?.message || JSON.stringify(err || '')).toLowerCase();
  return (
    msg.includes('404') ||
    msg.includes('not_found') ||
    msg.includes('is not found') ||
    msg.includes('not supported for generatecontent') ||
    msg.includes('only supports interactions api') ||
    msg.includes('not found for api version') ||
    msg.includes('500') ||
    msg.includes('internal error') ||
    msg.includes('503') ||
    msg.includes('service unavailable') ||
    msg.includes('overloaded')
  );
}

export function isRetryableModelFallbackError(err: any): boolean {
  return isQuotaOrRateLimitError(err) || isModelUnavailableError(err);
}

export function markModelRateLimited(modelId: string, cooldownMs = 60000): void {
  const actual = resolveActualModelId(modelId);
  modelRateLimitUntil.set(actual, Date.now() + cooldownMs);
}

export function isModelRateLimited(modelId: string): boolean {
  const actual = resolveActualModelId(modelId);
  const until = modelRateLimitUntil.get(actual);
  if (!until) return false;
  if (Date.now() >= until) {
    modelRateLimitUntil.delete(actual);
    return false;
  }
  return true;
}

export function clearModelRateLimits(): void {
  modelRateLimitUntil.clear();
}

export function orderModelsByAvailability(candidates: string[]): string[] {
  const ready: string[] = [];
  const cooled: string[] = [];
  for (const m of candidates) {
    const actual = resolveActualModelId(m);
    if (isModelRateLimited(actual)) {
      cooled.push(actual);
    } else {
      ready.push(actual);
    }
  }
  return [...ready, ...cooled];
}

export function formatUserFriendlyAiError(err: any): string {
  const raw = typeof err === 'string' ? err : (err?.message || JSON.stringify(err || ''));
  const lower = raw.toLowerCase();
  if (lower.includes('api_key_invalid') || lower.includes('401') || lower.includes('403')) {
    return 'مفتاح API غير صالح أو غير مفعل (خطأ 401/403). يرجى التحقق منه من زر المفتاح (🔑).';
  }
  if (isQuotaOrRateLimitError(raw)) {
    return 'تم بلوغ حد الحصة المؤقتة (429 Quota Exceeded) عبر النماذج المتاحة حالياً. يرجى الانتظار قليلاً أو إدخال مفتاح API مخصص من زر المفتاح (🔑).';
  }
  if (isModelUnavailableError(raw)) {
    return 'النموذج المحدد غير متاح حالياً وتمت محاولة البدائل المتاحة.';
  }
  if (lower.includes('thought signature') || lower.includes('function call')) {
    return 'حدث تعارض في استدعاء الأداة. يمكنك جلب النصوص القرآنية والحديثية مباشرة عبر زر الجلب الذكي السريع.';
  }
  return raw || 'تعذر الاتصال بخدمة الذكاء الاصطناعي حالياً.';
}

export function normalizeArabicIntentText(text: string): string {
  return (text || '')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim()
    .toLowerCase();
}

export function hasIslamicOrDataToolIntent(text: string): boolean {
  const norm = normalizeArabicIntentText(text);
  if (!norm) return false;
  return /(سوره|ايه|ايات|مصحف|قران|تلاوه|استمع|اسمع|سماع|قارئ|صوت|mp3|حديث|احاديث|البخاري|مسلم|الترمذي|ابو داود|النسائي|ابن ماجه|fetch_quran|fetch_hadith|fetch_api|https?:\/\/)/i.test(
    norm
  );
}

export function hasWebSearchIntent(text: string): boolean {
  const norm = normalizeArabicIntentText(text);
  if (!norm) return false;
  return /(ابحث|بحث|الويب|الانترنت|انترنت|جوجل|غوغل|google|search|web|مواقع|موقع الكتروني|احدث|اخبار|اليوم|2025|2026|سعر|طقس)/i.test(
    norm
  );
}

export interface ToolSelectionInput {
  modelId: string;
  enableEditorTools: boolean;
  enableGoogleSearch: boolean;
  isGreetingTurn: boolean;
  allowEditorMutation: boolean;
  lastUserMessage: string;
  declarations: any[];
}

export interface ToolSelectionResult {
  capabilities: ModelCapabilities;
  tools: any[];
  toolConfig?: { includeServerSideToolInvocations: boolean };
  usedFunctionDeclarations: boolean;
  usedGoogleSearch: boolean;
}

export function resolveToolSelectionForModel(input: ToolSelectionInput): ToolSelectionResult {
  const capabilities = getModelCapabilities(input.modelId);
  const {
    enableEditorTools,
    enableGoogleSearch,
    isGreetingTurn,
    allowEditorMutation,
    lastUserMessage,
    declarations,
  } = input;

  if (isGreetingTurn) {
    return {
      capabilities,
      tools: [],
      usedFunctionDeclarations: false,
      usedGoogleSearch: false,
    };
  }

  const wantsFunctions = enableEditorTools && capabilities.supportsFunctionCalling && declarations.length > 0;
  const wantsSearch = enableGoogleSearch && capabilities.supportsGoogleSearch;

  let includeFunctions = false;
  let includeSearch = false;

  if (wantsFunctions && wantsSearch) {
    if (capabilities.supportsHybridTools) {
      includeFunctions = true;
      includeSearch = true;
    } else {
      // Non-hybrid models (e.g., Gemini 2.5, 2.0, Robotics ER) must NEVER combine googleSearch + functionDeclarations
      const hasWebIntent = hasWebSearchIntent(lastUserMessage);
      const hasDataToolIntent = hasIslamicOrDataToolIntent(lastUserMessage);
      if (hasWebIntent && !allowEditorMutation) {
        includeSearch = true;
      } else if (allowEditorMutation || hasDataToolIntent) {
        includeFunctions = true;
      } else {
        includeSearch = true;
      }
    }
  } else if (wantsFunctions) {
    includeFunctions = true;
  } else if (wantsSearch) {
    includeSearch = true;
  }

  const tools: any[] = [];
  if (includeFunctions) {
    tools.push({ functionDeclarations: declarations });
  }
  if (includeSearch) {
    tools.push({ googleSearch: {} });
  }

  // Only enable includeServerSideToolInvocations when BOTH built-in & custom tools are combined AND model supports it
  const useHybridServerFlag =
    includeFunctions &&
    includeSearch &&
    capabilities.supportsHybridTools &&
    capabilities.supportsIncludeServerSideToolInvocations;

  return {
    capabilities,
    tools,
    ...(useHybridServerFlag ? { toolConfig: { includeServerSideToolInvocations: true } } : {}),
    usedFunctionDeclarations: includeFunctions,
    usedGoogleSearch: includeSearch,
  };
}

export function buildToolBridgeProtocolPrompt(
  allowEditorMutation: boolean,
  enableTools: boolean,
  enableSearch: boolean
): string {
  const lines: string[] = [
    '--- جسر الأدوات والبحث الذكي للنماذج القياسية ---',
    'لديك إمكانية الوصول الحقيقي لأدوات التطبيق والبحث عبر صيغة النداء التالية فقط عند الحاجة:',
    '<<<TOOL_CALL:{"name":"اسم_الأداة","args":{...}}>>>',
  ];

  if (enableSearch) {
    lines.push('- web_search({"query": "كلمات البحث"}) : للبحث المباشر في الإنترنت وجلب أحدث المعلومات والمصادر.');
  }
  if (enableTools) {
    lines.push(
      '- fetch_quran_surah({"surahIdentifier": "اسم السورة أو رقمها 1-114", "edition": "ar.uthmani"}) : لجلب نص سورة كاملة بدقة 100% دون هلوسة.',
      '- fetch_quran_ayah({"surahNumber": 1, "ayahNumber": 1, "edition": "ar.uthmani"}) : لجلب آية محددة.',
      '- fetch_quran_audio({"surahIdentifier": "اسم السورة أو رقمها", "reciter": "ar.alafasy"}) : لجلب روابط التلاوة الصوتية MP3.',
      '- fetch_hadith_data({"book": "bukhari", "number": 1}) : لجلب نص حديث شريف.',
      '- fetch_api_data({"url": "https://..."}) : لجلب بيانات من رابط أو API.'
    );
    if (allowEditorMutation) {
      lines.push(
        '- update_editor_code({"code": "كود بايثون الكامل"}) : لتحديث الكود داخل المحرر (عند طلب كتابة أو تعديل كود).',
        '- run_editor_code({}) : لتشغيل الكود الحالي في المحرر.'
      );
    }
  }

  lines.push(
    'عند استدعاء أداة جلب بيانات أو بحث، أخرج سطر <<<TOOL_CALL:...>>> أولاً، وسنزودك بالنتيجة الحقيقية لتصيغ إجابتك النهائية بدقة.'
  );

  return lines.join('\n');
}

export function parseBridgeToolCalls(text: string): {
  toolCalls: { name: string; args: Record<string, any> }[];
  cleanedText: string;
} {
  if (!text) return { toolCalls: [], cleanedText: '' };
  const toolCalls: { name: string; args: Record<string, any> }[] = [];
  let cleanedText = text;

  const regex = /<<<TOOL_CALL:([\s\S]*?)>>>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const rawJson = (match[1] || '').trim();
    try {
      const parsed = JSON.parse(rawJson);
      if (parsed && typeof parsed.name === 'string') {
        toolCalls.push({
          name: parsed.name,
          args: parsed.args && typeof parsed.args === 'object' ? parsed.args : {},
        });
      }
    } catch {
      // ignore malformed JSON
    }
  }

  cleanedText = cleanedText.replace(/<<<TOOL_CALL:[\s\S]*?>>>/g, '').trim();
  return { toolCalls, cleanedText };
}

export function formatGroundingFromSearchResults(
  results: { title: string; snippet: string; url: string }[],
  query: string
) {
  if (!results || results.length === 0) return null;
  return {
    webSearchQueries: query ? [query] : [],
    groundingChunks: results
      .filter((r) => r.url)
      .map((r) => ({
        web: {
          uri: r.url,
          title: r.title || r.url,
        },
      })),
  };
}


