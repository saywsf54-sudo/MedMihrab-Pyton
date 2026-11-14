import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { fetchSurahFromApi, fetchAyahFromApi, fetchHadithFromApi, fetchQuranAudioFromApi } from './src/services/quranApiService';
import { isPureGreetingOrSocial, hasCodeOrEditorIntent, getModelSequence } from './src/services/geminiService';
import {
  getModelCapabilities,
  resolveToolSelectionForModel,
  foldSystemInstructionIntoContents,
  isUnsupportedCapabilityError,
  downgradeConfigForUnsupportedError,
  isQuotaOrRateLimitError,
  isRetryableModelFallbackError,
  markModelRateLimited,
  formatUserFriendlyAiError,
  hasWebSearchIntent,
  buildToolBridgeProtocolPrompt,
  parseBridgeToolCalls,
  formatGroundingFromSearchResults,
  extractSearchKeywords,
} from './src/lib/modelCapabilities';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Helper to get GoogleGenAI client with User-Agent header
function getAiClient(customApiKey?: string): GoogleGenAI {
  const apiKey = (customApiKey && customApiKey.trim())
    ? customApiKey.trim()
    : process.env.GEMINI_API_KEY || process.env.API_KEY || '';

  if (!apiKey) {
    throw new Error('لم يتم العثور على مفتاح API (GEMINI_API_KEY) في الخادم.');
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

// Server-Side Data Fetching Tool Executor for Gemini Function Calls
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
    if (!url || typeof url !== 'string') return "Error: no URL provided";
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return "Error: only http and https protocols are allowed";
      }
      const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(parsedUrl.toString())}`);
      if (!res.ok) throw new Error("Status " + res.status);
      return await res.text();
    } catch (e: any) {
      return "Error fetching URL: " + e.message;
    }
  }

  return "Unknown tool";
}

interface WebSearchItem {
  title: string;
  snippet: string;
  url: string;
}

async function performServerWebSearch(query: string): Promise<{ results: WebSearchItem[]; groundingMetadata: any }> {
  const cleanQuery = extractSearchKeywords(query);
  if (!cleanQuery) return { results: [], groundingMetadata: null };

  const results: WebSearchItem[] = [];
  const fetchWithTimeout = async (url: string, ms = 5000) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { 'Accept': 'application/json', 'User-Agent': 'MedMihrabWebBridge/1.0' }
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  const hasArabic = /[\u0600-\u06FF]/.test(cleanQuery);
  const wikiLang = hasArabic ? 'ar' : 'en';
  const wikiUrl = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&utf8=1&format=json&srlimit=5`;
  const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_html=1&skip_disambig=1`;

  const [wikiData, ddgData] = await Promise.all([
    fetchWithTimeout(wikiUrl),
    fetchWithTimeout(ddgUrl),
  ]);

  if (ddgData) {
    if (ddgData.AbstractText && ddgData.AbstractURL) {
      results.push({
        title: ddgData.Heading || cleanQuery,
        snippet: ddgData.AbstractText,
        url: ddgData.AbstractURL,
      });
    }
    if (Array.isArray(ddgData.RelatedTopics)) {
      for (const topic of ddgData.RelatedTopics.slice(0, 4)) {
        if (topic?.Text && topic?.FirstURL) {
          results.push({
            title: String(topic.Text).split(' - ')[0].slice(0, 90),
            snippet: String(topic.Text),
            url: String(topic.FirstURL),
          });
        }
      }
    }
  }

  const wikiHits = wikiData?.query?.search;
  if (Array.isArray(wikiHits)) {
    for (const hit of wikiHits.slice(0, 5)) {
      const title = String(hit.title || '');
      const snippet = String(hit.snippet || '').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
      if (title) {
        results.push({
          title,
          snippet,
          url: `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, '_'))}`,
        });
      }
    }
  }

  const seenUrls = new Set<string>();
  const uniqueResults = results.filter((item) => {
    if (!item.url || seenUrls.has(item.url)) return false;
    seenUrls.add(item.url);
    return true;
  }).slice(0, 6);

  return {
    results: uniqueResults,
    groundingMetadata: formatGroundingFromSearchResults(uniqueResults, cleanQuery),
  };
}

/* =========================================================================
   SERVER API ENDPOINTS
   ========================================================================= */

// 1. Test Key Connection
app.post('/api/gemini/test-key', async (req, res) => {
  try {
    const customKey = req.body?.apiKey || (req.headers['x-custom-api-key'] as string);
    const preferredModel = req.body?.modelName || 'gemini-2.5-flash';
    const ai = getAiClient(customKey);
    const modelsToTry = getModelSequence(preferredModel);
    let lastErrorMsg = '';

    for (const modelId of modelsToTry) {
      try {
        const probe = await ai.models.generateContent({
          model: modelId,
          contents: 'مرحبا',
          config: { maxOutputTokens: 10 }
        });
        if (probe) {
          return res.json({ success: true, message: `تم الاتصال بنجاح عبر نموذج (${modelId})! المفتاح صالح ومستعد لتشغيل كافة نماذج المنصة عبر الخادم.` });
        }
      } catch (probeErr: any) {
        lastErrorMsg = probeErr?.message || String(probeErr);
        if (lastErrorMsg.includes("API_KEY_INVALID") || lastErrorMsg.includes("401") || lastErrorMsg.includes("403")) {
          return res.status(401).json({ success: false, message: "مفتاح API غير صالح أو غير مفعل (خطأ 401/403). يرجى التأكد من نسخه بشكل صحيح." });
        }
      }
    }

    if (lastErrorMsg.includes("429") || lastErrorMsg.includes("RESOURCE_EXHAUSTED")) {
      res.json({ success: true, message: "المفتاح صحيح ومتصل، لكن تم استهلاك الحد اليومي/الدقيقة المسموح به (429 Quota Exceeded)." });
    } else {
      res.status(500).json({ success: false, message: `تعذر الاتصال بالمفتاح: ${lastErrorMsg || 'لم يتم استلام رد صالح من الخادم.'}` });
    }
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes("API_KEY_INVALID") || msg.includes("401") || msg.includes("403")) {
      res.status(401).json({ success: false, message: "مفتاح API غير صالح أو غير مفعل (خطأ 401/403). يرجى التأكد من نسخه بشكل صحيح." });
    } else if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
      res.json({ success: true, message: "المفتاح صحيح ومتصل، لكن تم استهلاك الحد اليومي/الدقيقة المسموح به (429 Quota Exceeded)." });
    } else {
      res.status(500).json({ success: false, message: `تعذر الاتصال بالمفتاح: ${msg}` });
    }
  }
});

// In-memory cache for models listing to keep dev & prod environment fast
let serverModelsCache: { timestamp: number; key: string; models: any[] } | null = null;

// 2. Fetch Available Models List (All API models with exact API calling names)
app.get('/api/gemini/models', async (req, res) => {
  const customKey = (req.headers['x-custom-api-key'] as string || '').trim();
  const forceRefresh = req.query.refresh === '1';
  const now = Date.now();

  if (!forceRefresh && serverModelsCache && (now - serverModelsCache.timestamp < 600000) && serverModelsCache.key === customKey && serverModelsCache.models.length > 0) {
    return res.json({ models: serverModelsCache.models });
  }

  try {
    const ai = getAiClient(customKey);

    const fetchPromise = (async () => {
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
      return modelsList;
    })();

    const timeoutPromise = new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 8000));
    const modelsList = await Promise.race([fetchPromise, timeoutPromise]);

    if (modelsList.length > 0) {
      serverModelsCache = { timestamp: Date.now(), key: customKey, models: modelsList };
    }

    res.json({ models: modelsList.length > 0 ? modelsList : (serverModelsCache?.models || []) });
  } catch (err: any) {
    res.json({ models: serverModelsCache?.models || [], error: err?.message || String(err) });
  }
});

// 2b. Web Search Bridge Endpoint for models without native Google Search grounding
app.get('/api/web-search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const data = await performServerWebSearch(q);
  res.json(data);
});

app.post('/api/web-search', async (req, res) => {
  const q = String(req.body?.query || req.query?.q || '').trim();
  const data = await performServerWebSearch(q);
  res.json(data);
});

// 2c. Gemini Text-to-Speech (TTS) Endpoint using gemini-3.8-flash-lite-tts
app.post('/api/gemini/tts', async (req, res) => {
  try {
    const customKey = req.headers['x-custom-api-key'] as string;
    const { text, voice = "Kore" } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'No text provided for TTS' });
    }

    const ai = getAiClient(customKey);
    const cleanText = text.replace(/```[\s\S]*?```/g, ' كود برمجي ').replace(/[#*_`]/g, '');

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash-lite-tts",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: cleanText,
              speechMetadata: {
                style: "Clear and professional Arabic reader",
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice || "Kore",
            },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error('No audio generated by Gemini TTS model.');
    }

    res.json({ audioBase64: base64Audio });
  } catch (err: any) {
    res.status(500).json({ error: formatUserFriendlyAiError(err) });
  }
});

// 3. Generate Smart Persona
app.post('/api/gemini/generate-persona', async (req, res) => {
  try {
    const customKey = req.headers['x-custom-api-key'] as string;
    const { userHint, modelName = "gemini-2.5-flash" } = req.body;
    const ai = getAiClient(customKey);

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

    const candidates = getModelSequence(modelName);
    let lastErr: any = null;

    for (const candidateModel of candidates) {
      const caps = getModelCapabilities(candidateModel);
      try {
        const response = await ai.models.generateContent({
          model: candidateModel,
          contents: prompt,
          config: caps.supportsSamplingParams ? { temperature: 0.8 } : {}
        });
        return res.json({ persona: response.text?.trim() || '' });
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

    throw lastErr || new Error('تعذر توليد التوجيه.');
  } catch (err: any) {
    res.status(500).json({ error: formatUserFriendlyAiError(err) });
  }
});

// 4. Stream Chat Message (Server-Sent Events)
app.post('/api/gemini/chat-stream', async (req, res) => {
  const customKey = req.headers['x-custom-api-key'] as string;
  const { messages, systemInstruction, modelName = "gemini-2.5-flash", currentImagesBase64 = [], settings = {}, disableFallback = false } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const ai = getAiClient(customKey);

    const lastUserMessage = Array.isArray(messages)
      ? ([...messages].reverse().find((m: any) => m.role === 'user')?.content || '')
      : '';
    const isGreetingTurn = isPureGreetingOrSocial(lastUserMessage);
    const allowEditorMutation = !isGreetingTurn && hasCodeOrEditorIntent(lastUserMessage, currentImagesBase64.length > 0);

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
        description: "Fetches complete text and metadata of a Quran Surah (1 to 114) directly via API 100% complete without truncation.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            surahIdentifier: { type: Type.STRING, description: "Surah number (1-114) or Surah name" },
            edition: { type: Type.STRING, description: "Edition/Riwayah identifier" }
          },
          required: ["surahIdentifier"]
        }
      },
      {
        name: "fetch_quran_ayah",
        description: "Fetches specific Quran Ayah text directly via API.",
        parameters: { type: Type.OBJECT, properties: { surahNumber: { type: Type.NUMBER }, ayahNumber: { type: Type.NUMBER }, edition: { type: Type.STRING } }, required: ["surahNumber", "ayahNumber"] }
      },
      {
        name: "fetch_hadith_data",
        description: "Fetches Hadith text from books directly via API.",
        parameters: { type: Type.OBJECT, properties: { book: { type: Type.STRING }, number: { type: Type.NUMBER } }, required: ["book", "number"] }
      },
      {
        name: "fetch_api_data",
        description: "Fetches data from a web API or URL.",
        parameters: { type: Type.OBJECT, properties: { url: { type: Type.STRING } }, required: ["url"] }
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

    const effectiveSystemInstruction = settings.systemPromptOverride && settings.systemPromptOverride.trim()
      ? `${settings.systemPromptOverride.trim()}\n\n--- التعليمات والسياق التقني التشغيلي ---\n${systemInstruction}`
      : systemInstruction;

    const baseContents: any[] = messages
      .filter((msg: any) => msg.content && msg.content.trim().length > 0)
      .map((msg: any, index: number, arr: any[]) => {
        const parts: any[] = [{ text: msg.content }];
        if (index === arr.length - 1 && msg.role === 'user' && currentImagesBase64.length > 0) {
          currentImagesBase64.forEach((img: string) => {
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

    const candidates = disableFallback ? [modelName] : getModelSequence(modelName);
    let lastErr: any = null;

    for (const candidateModel of candidates) {
      let emittedAnyChunk = false;
      try {
        const toolSelection = resolveToolSelectionForModel({
          modelId: candidateModel,
          enableEditorTools: settings.enableEditorTools ?? true,
          enableGoogleSearch: settings.enableGoogleSearch ?? true,
          isGreetingTurn,
          allowEditorMutation,
          lastUserMessage,
          declarations,
        });
        const caps = toolSelection.capabilities;
        const wantsTools = Boolean(settings.enableEditorTools ?? true) && !isGreetingTurn;
        const wantsSearch = Boolean(settings.enableGoogleSearch ?? true) && !isGreetingTurn;
        const bridgeEnabled = settings.enableToolBridge !== false;

        const needsFunctionBridge = bridgeEnabled && wantsTools && !toolSelection.usedFunctionDeclarations;
        const needsSearchBridge = bridgeEnabled && wantsSearch && !toolSelection.usedGoogleSearch;
        const usingToolBridge = needsFunctionBridge || needsSearchBridge;

        let modelSystemInstruction = effectiveSystemInstruction;
        let modelBaseContents = baseContents;
        let groundingMetadata: any = null;

        if (needsSearchBridge && hasWebSearchIntent(lastUserMessage)) {
          const preSearch = await performServerWebSearch(lastUserMessage);
          if (preSearch.results.length > 0) {
            groundingMetadata = preSearch.groundingMetadata;
            const searchContext = `\n\n--- نتائج البحث المباشر من الويب ---\n${JSON.stringify(preSearch.results, null, 2)}\nاستخدم هذه المعلومات والمصادر الموثوقة في إجابتك.`;
            modelSystemInstruction += searchContext;
          }
        }

        if (usingToolBridge) {
          modelSystemInstruction = `${modelSystemInstruction}\n\n${buildToolBridgeProtocolPrompt(allowEditorMutation, needsFunctionBridge, needsSearchBridge)}`;
        }

        let activeContents: any[] = modelBaseContents;
        let currentConfig: any = {
          maxOutputTokens: settings.maxOutputTokens ?? 65536,
        };

        if (caps.supportsSamplingParams) {
          currentConfig.temperature = settings.temperature ?? 0.7;
          currentConfig.topP = settings.topP ?? 0.95;
          currentConfig.topK = settings.topK ?? 40;
        }

        if (caps.supportsSystemInstruction) {
          currentConfig.systemInstruction = modelSystemInstruction;
        } else {
          activeContents = foldSystemInstructionIntoContents(modelBaseContents, modelSystemInstruction);
        }

        if (toolSelection.tools.length > 0) {
          currentConfig.tools = toolSelection.tools;
        }
        if (toolSelection.toolConfig) {
          currentConfig.toolConfig = toolSelection.toolConfig;
        }

        let accumulatedText = "";
        let functionCalls: any[] = [];
        let streamParts: any[] = [];
        let isMaxTokens = false;

        const runStream = async (currentContents: any[], emitChunk = true) => {
          for (let attempt = 0; attempt <= 3; attempt++) {
            let emittedInAttempt = false;
            try {
              isMaxTokens = false;
              const responseStream = await ai.models.generateContentStream({
                model: candidateModel,
                contents: currentContents,
                config: currentConfig
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
                  if (emitChunk) {
                    const visible = accumulatedText.replace(/<<<TOOL_CALL:[\s\S]*?(?:>>>|$)/g, '').trim();
                    if (visible) {
                      emittedAnyChunk = true;
                      sendEvent({ type: 'chunk', text: visible });
                    }
                  }
                }
                if (chunk.functionCalls && chunk.functionCalls.length > 0) {
                  emittedInAttempt = true;
                  emittedAnyChunk = true;
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
                currentConfig,
                modelSystemInstruction,
                attempt
              );
              if (!downgraded) throw err;
              console.warn(`Adjusting server stream config for model ${candidateModel} compatibility (step ${attempt + 1}).`);
              currentContents = downgraded.contents;
              activeContents = downgraded.contents;
              currentConfig = downgraded.config;
              streamParts = [];
            }
          }
        };

        await runStream(activeContents, !usingToolBridge);

        let continuationCount = 0;
        while (isMaxTokens && functionCalls.length === 0 && continuationCount < 5) {
          continuationCount++;
          activeContents.push({ role: 'model', parts: streamParts });
          activeContents.push({ role: 'user', parts: [{ text: "أكمل من حيث توقفت تماماً وبدون أي مقدمات أو اعتذار لتكتمل السورة أو النص." }] });
          streamParts = [];
          await runStream(activeContents, !usingToolBridge);
        }

        // Bridge tool loop for models without native function calling or search
        if (usingToolBridge) {
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
                const searchRes = await performServerWebSearch(String(bCall.args?.query || lastUserMessage));
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

          if (accumulatedText && !streamedSecondRound) {
            emittedAnyChunk = true;
            sendEvent({ type: 'chunk', text: accumulatedText });
          }
        }

        const fetchTools = ["fetch_quran_surah", "fetch_quran_ayah", "fetch_hadith_data", "fetch_api_data", "fetch_quran_audio"];
        if (functionCalls.length > 0 && functionCalls.some(c => fetchTools.includes(c.name))) {
          const toolCall = functionCalls.find(c => fetchTools.includes(c.name))!;
          const fetchedContent = await executeServerSideToolCall(toolCall);

          if (streamParts.length > 0) {
            activeContents.push({ role: 'model', parts: streamParts });
          } else {
            activeContents.push({ role: 'model', parts: [{ functionCall: toolCall as any }] });
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
          });

          const secondStream = await ai.models.generateContentStream({
            model: candidateModel,
            contents: activeContents,
            config: currentConfig
          });

          for await (const chunk of secondStream) {
            if (chunk.candidates?.[0]?.groundingMetadata) {
              groundingMetadata = chunk.candidates[0].groundingMetadata;
            }
            if (chunk.text) {
              emittedAnyChunk = true;
              accumulatedText += chunk.text;
              sendEvent({ type: 'chunk', text: accumulatedText });
            }
            if (chunk.functionCalls) {
              emittedAnyChunk = true;
              functionCalls.push(...chunk.functionCalls);
            }
          }
        }

        if (!accumulatedText.trim() && functionCalls.length === 0) {
          throw new Error('503 service unavailable: empty model response');
        }

        sendEvent({ type: 'done', text: accumulatedText, functionCalls, groundingMetadata, modelUsed: candidateModel });
        res.end();
        return;
      } catch (err: any) {
        lastErr = err;
        if (isQuotaOrRateLimitError(err)) {
          markModelRateLimited(candidateModel);
        }
        if (!disableFallback && !emittedAnyChunk && isRetryableModelFallbackError(err)) {
          console.warn(`Server stream model ${candidateModel} unavailable or rate-limited (429/404), trying next fallback model...`);
          continue;
        }
        throw err;
      }
    }

    throw lastErr || new Error('تعذر الاتصال بالنماذج المتاحة.');
  } catch (err: any) {
    console.warn("Server streaming chat warning:", formatUserFriendlyAiError(err));
    sendEvent({ type: 'error', error: formatUserFriendlyAiError(err), rawError: err?.message || String(err) });
    res.end();
  }
});

// 5. Explain and Fix Code Error
app.post('/api/gemini/explain-fix', async (req, res) => {
  try {
    const customKey = req.headers['x-custom-api-key'] as string;
    const { code, errorText, modelName = "gemini-2.5-flash" } = req.body;
    const ai = getAiClient(customKey);
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
        return res.json({
          errorSummary: parsed.errorSummary || "خطأ في تنفيذ البرنامج",
          explanation: parsed.explanation || "حدث خطأ أثناء معالجة البرنامج.",
          suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : ["تحقق من البيانات والمكتبات"],
          fixedCode: parsed.fixedCode || code
        });
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

    throw lastErr || new Error("تعذر تحليل الخطأ عبر النماذج المتاحة.");
  } catch (err: any) {
    res.json({
      errorSummary: "خطأ في تنفيذ السكريبت",
      explanation: formatUserFriendlyAiError(err),
      suggestions: ["تأكد من صحة الكود والمدخلات"],
      fixedCode: req.body?.code || ''
    });
  }
});

// 6. Execute Python Code via Gemini Code Execution
app.post('/api/gemini/execute-python', async (req, res) => {
  try {
    const customKey = req.headers['x-custom-api-key'] as string;
    const { code, modelName = "gemini-2.5-flash", timeoutMs = 45000 } = req.body;
    const ai = getAiClient(customKey);
    const baseSequence = getModelSequence(modelName);
    const candidates = [
      ...baseSequence.filter(m => getModelCapabilities(m).supportsCodeExecution),
      ...baseSequence.filter(m => !getModelCapabilities(m).supportsCodeExecution),
    ];

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
          setTimeout(() => reject(new Error("انتهى الوقت المحدد لتشغيل الكود (Timeout).")), timeoutMs);
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
        try { text = response.text || ""; } catch(e) {}

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
            const result = (part as any).codeExecutionResult;
            codeExecutionResult += `### نتيجة التنفيذ (${result.outcome}):\n\`\`\`text\n${result.output}\n\`\`\`\n\n`;
          }
        }

        return res.json({ text, codeExecutionResult, images });
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

    throw lastErr || new Error("تعذر تنفيذ الكود عبر النماذج المتاحة.");
  } catch (err: any) {
    res.status(500).json({ error: formatUserFriendlyAiError(err) });
  }
});

/* =========================================================================
   VITE DEV / PRODUCTION STATIC SERVER MOUNTING
   ========================================================================= */

if (process.env.NODE_ENV !== 'production') {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
    appType: 'custom'
  });
  app.use(vite.middlewares);
  app.use('*', async (req, res, next) => {
    const url = req.originalUrl;
    if (url.startsWith('/api/')) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
    try {
      let template = await fs.promises.readFile(path.resolve(__dirname, 'index.html'), 'utf-8');
      template = await vite.transformIndexHtml(url, template);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Full-stack server running on http://0.0.0.0:${PORT}`);
});
