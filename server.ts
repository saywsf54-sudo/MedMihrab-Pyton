import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { fetchSurahFromApi, fetchAyahFromApi, fetchHadithFromApi, fetchQuranAudioFromApi } from './src/services/quranApiService';
import { isPureGreetingOrSocial, hasCodeOrEditorIntent } from './src/services/geminiService';

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

function resolveActualModelId(modelId: string): string {
  if (!modelId || typeof modelId !== 'string') return 'gemini-3.6-flash';
  const clean = modelId.trim().replace(/^models\//, '');
  if (clean === 'gemini-3.1-pro-preview-customtools') {
    return 'gemini-3.1-pro-preview';
  }
  return clean;
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

/* =========================================================================
   SERVER API ENDPOINTS
   ========================================================================= */

// 1. Test Key Connection
app.post('/api/gemini/test-key', async (req, res) => {
  try {
    const customKey = req.body?.apiKey || (req.headers['x-custom-api-key'] as string);
    const ai = getAiClient(customKey);
    const probe = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: 'مرحبا',
      config: { maxOutputTokens: 10 }
    });

    if (probe) {
      res.json({ success: true, message: "تم الاتصال بنجاح! المفتاح صالح ومستعد لتشغيل كافة نماذج المنصة عبر الخادم." });
    } else {
      res.json({ success: false, message: "لم يتم استلام رد صالح من الخادم." });
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

// 2. Fetch Available Models List
app.get('/api/gemini/models', async (req, res) => {
  const customKey = (req.headers['x-custom-api-key'] as string || '').trim();
  const now = Date.now();

  // Return cached models if fresh (10 mins)
  if (serverModelsCache && (now - serverModelsCache.timestamp < 600000) && serverModelsCache.key === customKey && serverModelsCache.models.length > 0) {
    return res.json({ models: serverModelsCache.models });
  }

  try {
    const ai = getAiClient(customKey);
    
    // Perform model listing with a 2.5s timeout safeguard
    const fetchPromise = (async () => {
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
      return modelsList;
    })();

    const timeoutPromise = new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 2500));
    const modelsList = await Promise.race([fetchPromise, timeoutPromise]);

    if (modelsList.length > 0) {
      serverModelsCache = { timestamp: Date.now(), key: customKey, models: modelsList };
    }

    res.json({ models: modelsList.length > 0 ? modelsList : (serverModelsCache?.models || []) });
  } catch (err: any) {
    res.json({ models: serverModelsCache?.models || [], error: err?.message || String(err) });
  }
});

// 3. Generate Smart Persona
app.post('/api/gemini/generate-persona', async (req, res) => {
  try {
    const customKey = req.headers['x-custom-api-key'] as string;
    const { userHint, modelName = "gemini-3.6-flash" } = req.body;
    const ai = getAiClient(customKey);
    const actualModel = resolveActualModelId(modelName);

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

    const response = await ai.models.generateContent({
      model: actualModel,
      contents: prompt,
      config: { temperature: 0.8 }
    });

    res.json({ persona: response.text?.trim() || '' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

// 4. Stream Chat Message (Server-Sent Events)
app.post('/api/gemini/chat-stream', async (req, res) => {
  const customKey = req.headers['x-custom-api-key'] as string;
  const { messages, systemInstruction, modelName = "gemini-3.6-flash", currentImagesBase64 = [], settings = {} } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const ai = getAiClient(customKey);
    const actualModelName = resolveActualModelId(modelName);
    const isGemma = actualModelName.includes('gemma');

    const lastUserMessage = Array.isArray(messages)
      ? ([...messages].reverse().find((m: any) => m.role === 'user')?.content || '')
      : '';
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

    const contents: any[] = messages
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
          sendEvent({ type: 'chunk', text: accumulatedText });
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

    let continuationCount = 0;
    while (isMaxTokens && functionCalls.length === 0 && continuationCount < 5) {
      continuationCount++;
      contents.push({ role: 'model', parts: streamParts });
      contents.push({ role: 'user', parts: [{ text: "أكمل من حيث توقفت تماماً وبدون أي مقدمات أو اعتذار لتكتمل السورة أو النص." }] });
      streamParts = [];
      await runStream(contents);
    }

    const fetchTools = ["fetch_quran_surah", "fetch_quran_ayah", "fetch_hadith_data", "fetch_api_data", "fetch_quran_audio"];
    if (functionCalls.length > 0 && functionCalls.some(c => fetchTools.includes(c.name))) {
      const toolCall = functionCalls.find(c => fetchTools.includes(c.name))!;
      const fetchedContent = await executeServerSideToolCall(toolCall);

      if (streamParts.length > 0) {
        contents.push({ role: 'model', parts: streamParts });
      } else {
        contents.push({ role: 'model', parts: [{ functionCall: toolCall as any }] });
      }

      contents.push({
        role: 'user',
        parts: [{
          functionResponse: {
            name: toolCall.name,
            response: { result: fetchedContent }
          }
        }]
      });

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
          sendEvent({ type: 'chunk', text: accumulatedText });
        }
        if (chunk.functionCalls) {
          functionCalls.push(...chunk.functionCalls);
        }
      }
    }

    sendEvent({ type: 'done', text: accumulatedText, functionCalls, groundingMetadata });
    res.end();
  } catch (err: any) {
    console.error("Server streaming chat error:", err);
    sendEvent({ type: 'error', error: err?.message || String(err) });
    res.end();
  }
});

// 5. Explain and Fix Code Error
app.post('/api/gemini/explain-fix', async (req, res) => {
  try {
    const customKey = req.headers['x-custom-api-key'] as string;
    const { code, errorText, modelName = "gemini-3.6-flash" } = req.body;
    const ai = getAiClient(customKey);
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
    res.json({
      errorSummary: parsed.errorSummary || "خطأ في تنفيذ البرنامج",
      explanation: parsed.explanation || "حدث خطأ أثناء معالجة البرنامج.",
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : ["تحقق من البيانات والمكتبات"],
      fixedCode: parsed.fixedCode || code
    });
  } catch (err: any) {
    res.json({
      errorSummary: "خطأ في تنفيذ السكريبت",
      explanation: err?.message || String(err),
      suggestions: ["تأكد من صحة الكود والمدخلات"],
      fixedCode: req.body?.code || ''
    });
  }
});

// 6. Execute Python Code via Gemini Code Execution
app.post('/api/gemini/execute-python', async (req, res) => {
  try {
    const customKey = req.headers['x-custom-api-key'] as string;
    const { code, modelName = "gemini-3.6-flash", timeoutMs = 45000 } = req.body;
    const ai = getAiClient(customKey);
    const actualModelName = resolveActualModelId(modelName);
    const isGemma = actualModelName.includes('gemma');

    const prompt = `Please execute the following Python code and return the output.\n\n\`\`\`python\n${code}\n\`\`\`\n\nIf the code generates visualizations or plots, ensure they are returned.`;

    const config: any = { temperature: 0 };
    if (!isGemma) {
      config.tools = [{ codeExecution: {} }];
    }

    const responsePromise = ai.models.generateContent({
      model: actualModelName,
      contents: prompt,
      config
    });

    const timeoutPromise = new Promise<any>((_, reject) => {
      setTimeout(() => reject(new Error("انتهى الوقت المحدد لتشغيل الكود (Timeout).")), timeoutMs);
    });

    const response = await Promise.race([responsePromise, timeoutPromise]);

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

    res.json({ text, codeExecutionResult, images });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
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
