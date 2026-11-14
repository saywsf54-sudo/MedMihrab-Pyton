import { useState } from 'react';
import { 
  X, BookOpen, FileCode, MessageSquare, Download, Globe,
  Search, Database, Layers, CheckCircle2
} from 'lucide-react';
import { 
  QURAN_SURAHS_META, HADITH_BOOKS, QURAN_EDITIONS, 
  fetchSurahFromApi, fetchAyahFromApi, fetchHadithFromApi, 
  generatePythonApiSnippet 
} from '../services/quranApiService';

interface SmartTextFetcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertCodeToEditor: (code: string) => void;
  onInsertTextToEditor: (text: string) => void;
  onSendToChat: (promptText: string) => void;
}

export default function SmartTextFetcherModal({
  isOpen,
  onClose,
  onInsertCodeToEditor,
  onInsertTextToEditor,
  onSendToChat
}: SmartTextFetcherModalProps) {
  const [activeCategory, setActiveCategory] = useState<'surah' | 'ayah' | 'hadith' | 'custom_api'>('surah');

  // Surah Options
  const [selectedSurahNum, setSelectedSurahNum] = useState<number>(1);
  const [selectedEdition, setSelectedEdition] = useState<string>('ar.uthmani');
  const [surahSearchQuery, setSurahSearchQuery] = useState<string>('');

  // Ayah Options
  const [ayahSurahNum, setAyahSurahNum] = useState<number>(1);
  const [ayahNumber, setAyahNumber] = useState<number>(1);

  // Hadith Options
  const [selectedHadithBook, setSelectedHadithBook] = useState<string>('bukhari');
  const [hadithNumber, setHadithNumber] = useState<number>(1);

  // Custom API
  const [customApiUrl, setCustomApiUrl] = useState<string>('https://api.alquran.cloud/v1/surah/1/ar.uthmani');

  // Status
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredSurahs = QURAN_SURAHS_META.filter(s => 
    s.name.includes(surahSearchQuery) || 
    s.englishName.toLowerCase().includes(surahSearchQuery.toLowerCase()) ||
    s.number.toString() === surahSearchQuery
  );

  const currentSurahMeta = QURAN_SURAHS_META.find(s => s.number === selectedSurahNum) || QURAN_SURAHS_META[0];

  // Action 1: Insert Python API Snippet to Editor
  const handleGeneratePythonSnippet = () => {
    let code = '';
    if (activeCategory === 'surah') {
      code = generatePythonApiSnippet('surah', { surahNumber: selectedSurahNum, edition: selectedEdition });
    } else if (activeCategory === 'ayah') {
      code = generatePythonApiSnippet('ayah', { surahNumber: ayahSurahNum, ayahNumber: ayahNumber, edition: selectedEdition });
    } else if (activeCategory === 'hadith') {
      code = generatePythonApiSnippet('hadith', { book: selectedHadithBook, hadithNumber: hadithNumber });
    } else {
      code = generatePythonApiSnippet('custom_url', { customUrl: customApiUrl });
    }

    onInsertCodeToEditor(code);
    setStatusMessage('تم إدراج كود بايثون الجلب الذكي بالمحرر بنجاح!');
    setTimeout(() => { setStatusMessage(null); onClose(); }, 1200);
  };

  // Action 2: Direct Fetch Text & Insert into Editor
  const handleFetchDirectTextToEditor = async () => {
    setIsLoading(true);
    setStatusMessage('جاري جلب البيانات مباشرة عبر API...');
    try {
      let rawText = '';
      if (activeCategory === 'surah') {
        const data = await fetchSurahFromApi(selectedSurahNum, selectedEdition);
        if (data) {
          rawText = `# سورة ${data.name} (${data.englishName})\n# عدد الآيات: ${data.numberOfAyahs} | النوع: ${data.revelationType}\n\n`;
          data.ayahs.forEach((a: any) => {
            rawText += `[${a.numberInSurah}] ${a.text}\n`;
          });
        }
      } else if (activeCategory === 'ayah') {
        const data = await fetchAyahFromApi(ayahSurahNum, ayahNumber, selectedEdition);
        if (data) {
          rawText = `# آية من سورة ${data.surah?.name} [${data.numberInSurah}]\n\n${data.text}\n`;
        }
      } else if (activeCategory === 'hadith') {
        const data = await fetchHadithFromApi(selectedHadithBook, hadithNumber);
        if (data) {
          rawText = `# حديث رقم ${data.hadithnumber || hadithNumber} من كتاب ${selectedHadithBook}\n\n${data.text}\n`;
        }
      } else {
        const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(customApiUrl)}`);
        rawText = await res.text();
      }

      onInsertTextToEditor(rawText);
      setStatusMessage('تم جلب النص وإدراجه في المحرر بنجاح!');
      setTimeout(() => { setStatusMessage(null); onClose(); }, 1200);
    } catch (err: any) {
      console.error(err);
      setStatusMessage(`خطأ في الجلب: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Action 3: Send Prompt to Chat
  const handleSendPromptToChat = () => {
    let prompt = '';
    if (activeCategory === 'surah') {
      prompt = `يرجى إجراء تحليل شامل وإحصاء لألفاظ سورة ${currentSurahMeta.name} (سورة رقم ${selectedSurahNum}). بدلاً من كتابة النص كاملاً كقيم ثنائية، اكتب كود بايثون يجلب السورة عبر API وتنفيده تلقائياً وإظهار الرسوم والنتائج في المحرر.`;
    } else if (activeCategory === 'ayah') {
      prompt = `قم بتحليل وإحصاء الآية رقم ${ayahNumber} من سورة رقم ${ayahSurahNum} باستخدام كود بايثون ذكي يجلب الآية عبر API مباشرة.`;
    } else if (activeCategory === 'hadith') {
      prompt = `يرجى جلب وتحليل الحديث رقم ${hadithNumber} من كتاب ${selectedHadithBook} باستخدام كود بايثون والجلب الإلكتروني التلقائي.`;
    } else {
      prompt = `أريد قراءة البيانات وتحليلها من الرابط: ${customApiUrl}. قم باستخدام أداة fetch_api_data وتحديث المحرر بكود بايثون لمعالجة البيانات.`;
    }

    onSendToChat(prompt);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150" dir="rtl">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500 text-white rounded-xl shadow-2xs">
              <Database size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                محرك الجلب الذكي للنصوص و APIs القرآنية
                <span className="text-[10px] font-mono bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                  توفير التوكنات (Token Efficient)
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                جلب السور، الآيات والأحاديث والنصوص الطويلة تلقائياً عبر API لتجنب استهلاك حد التوكنات
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Category Selector Tabs */}
        <div className="px-4 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveCategory('surah')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeCategory === 'surah'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
            }`}
          >
            <BookOpen size={14} />
            سور القرآن الكريم (114 سورة)
          </button>

          <button
            onClick={() => setActiveCategory('ayah')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeCategory === 'ayah'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
            }`}
          >
            <Layers size={14} />
            آية قرآنية محددة
          </button>

          <button
            onClick={() => setActiveCategory('hadith')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeCategory === 'hadith'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
            }`}
          >
            <Database size={14} />
            كتب الحديث الشريف
          </button>

          <button
            onClick={() => setActiveCategory('custom_api')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeCategory === 'custom_api'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
            }`}
          >
            <Globe size={14} />
            رابط API خارجي عام
          </button>
        </div>

        {/* Modal Body / Selection Fields */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {statusMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* SURAH CATEGORY */}
          {activeCategory === 'surah' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Surah Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">اختر السورة القرآنية:</label>
                  <div className="relative mb-2">
                    <Search size={13} className="absolute right-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="ابحث عن اسم السورة أو رقمها..."
                      value={surahSearchQuery}
                      onChange={(e) => setSurahSearchQuery(e.target.value)}
                      className="w-full pr-8 pl-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                    />
                  </div>
                  <select
                    value={selectedSurahNum}
                    onChange={(e) => setSelectedSurahNum(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-semibold outline-none focus:border-blue-500 max-h-40"
                  >
                    {filteredSurahs.map(s => (
                      <option key={s.number} value={s.number}>
                        [{s.number}] سورة {s.name} - ({s.numberOfAyahs} آية - {s.revelationType === 'Meccan' ? 'مكية' : 'مدنية'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Edition / Narration Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">الرواية / المصحف والتفسير:</label>
                  <select
                    value={selectedEdition}
                    onChange={(e) => setSelectedEdition(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-semibold outline-none focus:border-blue-500 mt-7"
                  >
                    {QURAN_EDITIONS.map(ed => (
                      <option key={ed.id} value={ed.id}>
                        {ed.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Selected Surah Badge Info */}
              <div className="p-3 bg-blue-50/70 dark:bg-slate-800/60 rounded-xl border border-blue-100 dark:border-slate-700 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-blue-500 text-white font-bold text-xs flex items-center justify-center">
                    {currentSurahMeta.number}
                  </span>
                  <div>
                    <span className="font-bold">سورة {currentSurahMeta.name}</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                      {currentSurahMeta.englishName} • {currentSurahMeta.numberOfAyahs} آيات
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-white dark:bg-slate-900 rounded-lg text-[10px] font-bold text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-slate-700">
                  جاهزة للجلب عبر API
                </span>
              </div>
            </div>
          )}

          {/* AYAH CATEGORY */}
          {activeCategory === 'ayah' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">رقم السورة (1-114):</label>
                <input
                  type="number"
                  min={1}
                  max={114}
                  value={ayahSurahNum}
                  onChange={(e) => setAyahSurahNum(Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">رقم الآية:</label>
                <input
                  type="number"
                  min={1}
                  value={ayahNumber}
                  onChange={(e) => setAyahNumber(Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">الرواية:</label>
                <select
                  value={selectedEdition}
                  onChange={(e) => setSelectedEdition(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 outline-none"
                >
                  {QURAN_EDITIONS.map(ed => (
                    <option key={ed.id} value={ed.id}>{ed.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* HADITH CATEGORY */}
          {activeCategory === 'hadith' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">اختر كتاب الحديث الشريف:</label>
                <select
                  value={selectedHadithBook}
                  onChange={(e) => setSelectedHadithBook(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-semibold outline-none"
                >
                  {HADITH_BOOKS.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} (عدد الأحاديث: {b.total})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">رقم الحديث:</label>
                <input
                  type="number"
                  min={1}
                  value={hadithNumber}
                  onChange={(e) => setHadithNumber(Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 outline-none font-mono"
                />
              </div>
            </div>
          )}

          {/* CUSTOM API CATEGORY */}
          {activeCategory === 'custom_api' && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">أدخل رابط الـ API المباشر (Direct Endpoint URL):</label>
              <input
                type="text"
                value={customApiUrl}
                onChange={(e) => setCustomApiUrl(e.target.value)}
                placeholder="https://api.example.com/data.json"
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-mono outline-none focus:border-blue-500"
                dir="ltr"
              />
              <p className="text-[11px] text-slate-500">
                سيقوم المحرك بإنشاء كود بايثون متقدم مع ميزة التخزين المؤقت وتجنب حظر الـ CORS أو قص التوكنات.
              </p>
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            onClick={handleGeneratePythonSnippet}
            disabled={isLoading}
            className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all disabled:opacity-50"
          >
            <FileCode size={15} />
            توليد كود بايثون للجلب الذكي (إلى المحرر)
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleFetchDirectTextToEditor}
              disabled={isLoading}
              className="px-3.5 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Download size={14} className={isLoading ? "animate-bounce" : ""} />
              جلب وإدراج النص المباشر
            </button>

            <button
              onClick={handleSendPromptToChat}
              disabled={isLoading}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors disabled:opacity-50"
            >
              <MessageSquare size={14} />
              إرسال كطلب لـ Gemini
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
