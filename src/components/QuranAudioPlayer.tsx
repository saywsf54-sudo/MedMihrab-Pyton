import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, 
  Download, BookOpen, Check, Search, 
  RefreshCw, ChevronDown, Copy,
  Users, X, Filter
} from 'lucide-react';
import { 
  QURAN_RECITERS, 
  getAvailableReciters, 
  findReciterById, 
  syncRecitersFromApi, 
  fetchQuranAudioFromApi, 
  QuranReciter 
} from '../services/quranApiService';
import { copyToClipboard } from '../lib/utils';

interface AyahItem {
  numberInSurah: number;
  text: string;
  audio?: string;
}

interface QuranAudioPlayerProps {
  surahNumber: number;
  surahName?: string;
  reciterId?: string;
  initialAyahs?: AyahItem[];
  initialAyahNumber?: number;
}

export default function QuranAudioPlayer({
  surahNumber,
  surahName: initialSurahName,
  reciterId: initialReciterId = 'ar.alafasy',
  initialAyahs,
  initialAyahNumber
}: QuranAudioPlayerProps) {
  const [selectedReciter, setSelectedReciter] = useState<string>(initialReciterId);
  const [surahName, setSurahName] = useState<string>(initialSurahName || `سورة ${surahNumber}`);
  const [numberOfAyahs, setNumberOfAyahs] = useState<number>(initialAyahs?.length || 0);
  const [ayahs, setAyahs] = useState<AyahItem[]>(initialAyahs || []);
  const [currentAyahIndex, setCurrentAyahIndex] = useState<number>(
    initialAyahNumber ? initialAyahNumber - 1 : 0
  );

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [playMode, setPlayMode] = useState<'surah' | 'ayah'>('surah');
  
  const [showFullSurahText, setShowFullSurahText] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // Reciter Selection & Rewaya Filter Modal States
  const [allReciters, setAllReciters] = useState<QuranReciter[]>(getAvailableReciters());
  const [isReciterModalOpen, setIsReciterModalOpen] = useState<boolean>(false);
  const [reciterSearchQuery, setReciterSearchQuery] = useState<string>('');
  const [selectedRewayaCategory, setSelectedRewayaCategory] = useState<string>('all');
  const [isSyncingReciters, setIsSyncingReciters] = useState<boolean>(false);

  // Sync reciters state from global events
  useEffect(() => {
    const handleRecitersUpdated = (e: any) => {
      if (e.detail && Array.isArray(e.detail) && e.detail.length > 0) {
        setAllReciters(e.detail);
      }
    };
    window.addEventListener('quran-reciters-updated', handleRecitersUpdated);
    return () => {
      window.removeEventListener('quran-reciters-updated', handleRecitersUpdated);
    };
  }, []);

  const handleManualSyncReciters = async () => {
    setIsSyncingReciters(true);
    try {
      const updated = await syncRecitersFromApi();
      setAllReciters(updated);
    } finally {
      setIsSyncingReciters(false);
    }
  };

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentAyahRef = useRef<HTMLSpanElement | null>(null);

  const [audioSourceIndex, setAudioSourceIndex] = useState<number>(0);

  // Load Quran Data and Audio whenever Surah or Reciter changes
  useEffect(() => {
    let isMounted = true;
    setAudioSourceIndex(0);
    async function loadAudioData() {
      setIsLoading(true);
      try {
        const audioData = await fetchQuranAudioFromApi(surahNumber, selectedReciter);
        if (!isMounted) return;

        if (audioData) {
          setSurahName(audioData.surahName);
          setNumberOfAyahs(audioData.numberOfAyahs || 0);
          if (audioData.ayahs && audioData.ayahs.length > 0) {
            setAyahs(audioData.ayahs);
          }
        }
      } catch (err) {
        console.error("Failed to load audio data:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadAudioData();
    return () => { isMounted = false; };
  }, [surahNumber, selectedReciter]);

  // Construct audio URLs for full surah
  const paddedSurah = String(surahNumber).padStart(3, '0');
  const currentReciterObj = findReciterById(selectedReciter);

  const mp3QuranServers: Record<string, string> = {
    'ar.alafasy': `https://server8.mp3quran.net/afs/${paddedSurah}.mp3`,
    'ar.abdulbasitmurattal': `https://server7.mp3quran.net/basit/${paddedSurah}.mp3`,
    'ar.minshawi': `https://server10.mp3quran.net/minsh/${paddedSurah}.mp3`,
    'ar.hudhaify': `https://server9.mp3quran.net/hthfi/${paddedSurah}.mp3`,
    'ar.saoodshuraym': `https://server7.mp3quran.net/shur/${paddedSurah}.mp3`,
    'ar.sudais': `https://server11.mp3quran.net/sds/${paddedSurah}.mp3`,
    'ar.mahermuaiqly': `https://server12.mp3quran.net/maher/${paddedSurah}.mp3`,
    'ar.ghamadi': `https://server7.mp3quran.net/s_gmd/${paddedSurah}.mp3`,
    'ar.shaatree': `https://server11.mp3quran.net/shatri/${paddedSurah}.mp3`,
  };

  const candidateSurahUrls: string[] = [];
  if (currentReciterObj && currentReciterObj.server) {
    candidateSurahUrls.push(`${currentReciterObj.server}${paddedSurah}.mp3`);
  }
  if (mp3QuranServers[selectedReciter]) {
    candidateSurahUrls.push(mp3QuranServers[selectedReciter]);
  }
  candidateSurahUrls.push(`https://cdn.islamic.network/quran/audio-surah/128/${selectedReciter}/${surahNumber}.mp3`);

  const currentAyah = ayahs[currentAyahIndex];
  const fullSurahAudioUrl = candidateSurahUrls[audioSourceIndex] || candidateSurahUrls[0];

  const audioSrc = playMode === 'ayah' && currentAyah?.audio
    ? currentAyah.audio
    : fullSurahAudioUrl;

  const handleAudioError = () => {
    console.warn(`Audio playback error caught for URL: ${audioSrc}`);
    if (playMode === 'surah') {
      if (audioSourceIndex < candidateSurahUrls.length - 1) {
        setAudioSourceIndex(prev => prev + 1);
      } else {
        // Fallback gracefully to verse-by-verse mode
        setPlayMode('ayah');
      }
    } else {
      setIsPlaying(false);
    }
  };

  // Toggle Play / Pause
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.warn("Audio playback play() error caught:", err);
        setIsPlaying(false);
        if (playMode === 'surah') {
          if (audioSourceIndex < candidateSurahUrls.length - 1) {
            setAudioSourceIndex(prev => prev + 1);
          } else {
            setPlayMode('ayah');
          }
        }
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleEnded = async () => {
    if (playMode === 'ayah') {
      if (currentAyahIndex < ayahs.length - 1) {
        setCurrentAyahIndex(prev => prev + 1);
        await new Promise(r => setTimeout(r, 300));
        if (audioRef.current) {
          try {
            await audioRef.current.play();
            setIsPlaying(true);
          } catch {
            setIsPlaying(false);
          }
        }
      } else {
        setIsPlaying(false);
      }
    } else {
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current && Number.isFinite(time)) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.muted = false;
      setIsMuted(false);
    } else {
      audioRef.current.muted = true;
      setIsMuted(true);
    }
  };

  const changeRate = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const playSpecificAyah = async (ayahNumber: number) => {
    const idx = ayahs.findIndex(a => a.numberInSurah === ayahNumber);
    if (idx === -1) return;
    setCurrentAyahIndex(idx);
    setPlayMode('ayah');
    await new Promise(r => setTimeout(r, 120));
    try {
      await audioRef.current?.play();
      setIsPlaying(true);
    } catch (e) {
      console.warn('Playback failed:', e);
      setIsPlaying(false);
    }
  };

  const copyFullSurah = async () => {
    const text = ayahs.map(a => `﴿${a.numberInSurah}﴾ ${a.text}`).join(' ');
    const ok = await copyToClipboard(`${surahName}\n\n${text}`);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const filteredAyahs = ayahs.filter(a => a.text.includes(searchQuery));
  const activeReciter = QURAN_RECITERS.find(r => r.id === selectedReciter) || QURAN_RECITERS[0];

  return (
    <div className="my-3 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/20 shadow-md overflow-hidden text-right" dir="rtl">
      {/* Audio Element */}
      <audio
        ref={audioRef}
        src={audioSrc}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onLoadedMetadata={handleTimeUpdate}
        onError={handleAudioError}
      />

      {/* Header Bar */}
      <div className="px-4 py-3 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex items-center justify-between gap-2 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center font-bold text-amber-100">
            {surahNumber}
          </div>
          <div>
            <h3 className="font-bold text-base leading-tight text-white flex items-center gap-1.5">
              <span>{surahName}</span>
              <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-white/20 text-amber-100">
                {numberOfAyahs} آية
              </span>
            </h3>
            <p className="text-[11px] text-amber-100/90 font-sans">
              تلاوة: {activeReciter.name} ({activeReciter.style})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowFullSurahText(!showFullSurahText)}
            className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-medium flex items-center gap-1 transition-all"
            title="إخفاء / عرض المصحف"
          >
            <BookOpen size={13} />
            <span>{showFullSurahText ? 'طي النص' : 'عرض النص'}</span>
          </button>
        </div>
      </div>

      {/* Main Control Panel */}
      <div className="p-4 space-y-3">
        {/* Reciter & Playback Mode Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1">
                <Users size={13} className="text-amber-600 dark:text-amber-400" />
                <span>القارئ والرواية:</span>
              </label>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{allReciters.length} قارئ ورواية</span>
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsReciterModalOpen(true)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 hover:bg-amber-50/80 dark:hover:bg-slate-700/80 border border-amber-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 font-medium flex items-center justify-between gap-2 shadow-2xs hover:border-amber-400 transition-all text-right group"
            >
              <div className="truncate flex-1">
                <div className="font-bold text-xs text-slate-900 dark:text-amber-100 truncate">
                  {currentReciterObj ? currentReciterObj.name : 'اختر القارئ'}
                </div>
                <div className="text-[11px] text-amber-700 dark:text-amber-400 font-sans truncate">
                  {currentReciterObj ? currentReciterObj.style : 'جميع الروايات'}
                </div>
              </div>
              <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 px-2 py-1 rounded-lg text-[10px] font-bold group-hover:scale-105 transition-transform shrink-0">
                <span>تغيير</span>
                <ChevronDown size={12} />
              </div>
            </button>
          </div>

          <div>
            <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
              وضع التشغيل:
            </label>
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800/90 p-1 border border-slate-200 dark:border-slate-700 h-[42px]">
              <button
                onClick={() => setPlayMode('surah')}
                className={`flex-1 py-1 px-2 rounded-lg font-medium text-center transition-all flex items-center justify-center gap-1 ${
                  playMode === 'surah'
                    ? 'bg-amber-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>تلاوة السورة كاملة</span>
              </button>
              <button
                onClick={() => setPlayMode('ayah')}
                className={`flex-1 py-1 px-2 rounded-lg font-medium text-center transition-all flex items-center justify-center gap-1 ${
                  playMode === 'ayah'
                    ? 'bg-amber-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>آية بآية (مستقل)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Audio Scrub Seekbar & Timers */}
        <div className="space-y-1 pt-1">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full accent-amber-600 dark:accent-amber-500 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg"
          />
          <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400 font-mono" dir="ltr">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Player Buttons Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {/* Main Play Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (currentAyahIndex > 0 && ayahs[currentAyahIndex - 1]) {
                  playSpecificAyah(ayahs[currentAyahIndex - 1].numberInSurah);
                }
              }}
              disabled={currentAyahIndex === 0}
              className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-40 transition-colors"
              title="الآية السابقة"
            >
              <SkipForward size={16} />
            </button>

            <button
              onClick={togglePlay}
              disabled={isLoading}
              className="p-3 rounded-full bg-amber-600 hover:bg-amber-700 text-white shadow-md hover:scale-105 active:scale-95 transition-all"
              title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
            >
              {isLoading ? (
                <RefreshCw size={20} className="animate-spin" />
              ) : isPlaying ? (
                <Pause size={20} />
              ) : (
                <Play size={20} className="mr-0.5" />
              )}
            </button>

            <button
              onClick={() => {
                if (currentAyahIndex < ayahs.length - 1 && ayahs[currentAyahIndex + 1]) {
                  playSpecificAyah(ayahs[currentAyahIndex + 1].numberInSurah);
                }
              }}
              disabled={currentAyahIndex >= ayahs.length - 1}
              className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-40 transition-colors"
              title="الآية التالية"
            >
              <SkipBack size={16} />
            </button>
          </div>

          {/* Current Ayah Indicator */}
          {playMode === 'ayah' && ayahs[currentAyahIndex] && (
            <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-3 py-1 rounded-full border border-amber-300 dark:border-amber-800">
              الآية [{ayahs[currentAyahIndex].numberInSurah}] من {numberOfAyahs}
            </div>
          )}

          {/* Volume & Speed Controls */}
          <div className="flex items-center gap-2">
            {/* Speed Selector */}
            <div className="flex items-center gap-1 text-xs">
              {[0.75, 1, 1.25, 1.5].map(rate => (
                <button
                  key={rate}
                  onClick={() => changeRate(rate)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                    playbackRate === rate
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Volume Toggle */}
            <button
              onClick={toggleMute}
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-amber-600"
              title={isMuted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
            >
              {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>

            {/* Download Link */}
            <a
              href={audioSrc}
              download={`${surahName}_${selectedReciter}.mp3`}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-amber-600 transition-colors"
              title="تحميل الملف الصوتي MP3"
            >
              <Download size={16} />
            </a>
          </div>
        </div>
      </div>

      {/* Quran Text Reader Section */}
      {showFullSurahText && (
        <div className="border-t border-amber-200/80 dark:border-amber-900/40 p-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xs">
          {/* Reader Sub-Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs">
            {/* Search Box */}
            <div className="relative flex-1 max-w-xs">
              <Search size={13} className="absolute right-2.5 top-2 text-slate-400" />
              <input
                type="text"
                placeholder="بحث في آيات السورة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-8 pl-3 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={copyFullSurah}
                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-slate-700 dark:text-slate-200 rounded-lg flex items-center gap-1 transition-colors"
              >
                {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                <span>{copied ? 'تم النسخ!' : 'نسخ النص'}</span>
              </button>
            </div>
          </div>

          {/* Bismillah Header (Except Surah At-Tawbah 9 and Al-Fatiha 1) */}
          {surahNumber !== 9 && surahNumber !== 1 && (
            <div className="text-center font-serif text-amber-900 dark:text-amber-200 text-lg my-3 font-bold tracking-wide">
              بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
            </div>
          )}

          {/* Verses Container */}
          <div className="max-h-[380px] overflow-y-auto p-3 rounded-xl bg-amber-50/40 dark:bg-slate-950/50 border border-amber-200/60 dark:border-slate-800 space-y-2">
            {filteredAyahs.length === 0 ? (
              <p className="text-center text-slate-400 text-xs py-4">لم يتم العثور على نتائج للبحث</p>
            ) : (
              <div className="leading-[2.4] text-justify text-base sm:text-lg font-serif text-slate-900 dark:text-amber-50 tracking-wide">
                {filteredAyahs.map((ayah) => {
                  const currentAyahNumber = ayahs[currentAyahIndex]?.numberInSurah;
                  const isCurrentPlaying = playMode === 'ayah' && currentAyahNumber === ayah.numberInSurah;

                  return (
                    <span
                      key={ayah.numberInSurah}
                      ref={isCurrentPlaying ? currentAyahRef : null}
                      onClick={() => playSpecificAyah(ayah.numberInSurah)}
                      className={`inline cursor-pointer px-1 py-0.5 rounded transition-all duration-200 hover:bg-amber-200/60 dark:hover:bg-amber-900/40 ${
                        isCurrentPlaying
                          ? 'bg-amber-300/80 dark:bg-amber-800/80 text-amber-950 dark:text-white font-bold shadow-xs ring-2 ring-amber-500'
                          : ''
                      }`}
                    >
                      {ayah.text}{' '}
                      <span className="inline-flex items-center justify-center font-sans text-xs text-amber-700 dark:text-amber-400 mx-1 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-950/80 rounded-full border border-amber-300 dark:border-amber-800 select-none">
                        ﴿{ayah.numberInSurah}﴾
                      </span>{' '}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Comprehensive Reciter & Rewaya Selection Modal */}
      {isReciterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn text-right" dir="rtl">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 text-white flex items-center justify-between gap-3 shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-amber-100 shadow-inner">
                  <Users size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-white flex items-center gap-2">
                    <span>مكتبة القراء والروايات القرآنية الشاملة</span>
                    <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-100 border border-emerald-400/40 text-[11px] font-normal">
                      تحديث تلقائي مستمر
                    </span>
                  </h3>
                  <p className="text-xs text-amber-100/90 font-sans mt-0.5">
                    اختر القارئ والرواية المفضلين لديك من إجمالي {allReciters.length} قارئ ورواية متاحة
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleManualSyncReciters}
                  disabled={isSyncingReciters}
                  className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-amber-100 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
                  title="تحديث قائمة القراء من السيرفر الآن"
                >
                  <RefreshCw size={14} className={isSyncingReciters ? "animate-spin" : ""} />
                  <span className="hidden sm:inline">{isSyncingReciters ? "جاري التحديث..." : "تحديث القائمة"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsReciterModalOpen(false)}
                  className="p-1.5 rounded-xl bg-white/15 hover:bg-white/30 text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Controls Bar: Search & Rewaya Category Filter */}
            <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 space-y-3 shrink-0">
              {/* Search Field */}
              <div className="relative">
                <Search size={16} className="absolute right-3.5 top-3 text-amber-600 dark:text-amber-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="ابحث باسم القارئ، الشيخ، التلاوة، أو الرواية (مثال: المنشاوي، ورش، قالون، العفاسي...)"
                  value={reciterSearchQuery}
                  onChange={(e) => setReciterSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-10 py-2.5 bg-white dark:bg-slate-800 border border-amber-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-amber-500 outline-none shadow-2xs"
                />
                {reciterSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setReciterSearchQuery('')}
                    className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Rewaya Categories Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                <span className="text-slate-400 text-[11px] font-semibold flex items-center gap-1 pl-1 shrink-0">
                  <Filter size={12} />
                  <span>الروايات:</span>
                </span>
                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'hafs', label: 'حفص عن عاصم' },
                  { id: 'warsh', label: 'ورش عن نافع' },
                  { id: 'qalun', label: 'قالون عن نافع' },
                  { id: 'duri', label: 'الدوري' },
                  { id: 'susi', label: 'السوسي' },
                  { id: 'mujawwad', label: 'المصحف المجود' },
                  { id: 'muallim', label: 'المصحف المعلم' },
                  { id: 'other', label: 'قراءات أخرى' },
                ].map(cat => {
                  const isActive = selectedRewayaCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedRewayaCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all shrink-0 ${
                        isActive
                          ? 'bg-amber-600 text-white shadow-xs scale-102'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reciter Grid List */}
            <div className="p-3 sm:p-5 overflow-y-auto flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {(() => {
                const filteredList = allReciters.filter(r => {
                  const matchSearch =
                    !reciterSearchQuery.trim() ||
                    r.name.includes(reciterSearchQuery.trim()) ||
                    r.style.includes(reciterSearchQuery.trim()) ||
                    (r.englishName && r.englishName.toLowerCase().includes(reciterSearchQuery.trim().toLowerCase()));

                  if (!matchSearch) return false;

                  if (selectedRewayaCategory === 'all') return true;
                  if (selectedRewayaCategory === 'hafs') return r.style.includes('حفص');
                  if (selectedRewayaCategory === 'warsh') return r.style.includes('ورش');
                  if (selectedRewayaCategory === 'qalun') return r.style.includes('قالون');
                  if (selectedRewayaCategory === 'duri') return r.style.includes('الدوري');
                  if (selectedRewayaCategory === 'susi') return r.style.includes('السوسي');
                  if (selectedRewayaCategory === 'mujawwad') return r.style.includes('مجود') || r.style.includes('مجوّد');
                  if (selectedRewayaCategory === 'muallim') return r.style.includes('المعلم');
                  if (selectedRewayaCategory === 'other') {
                    return !r.style.includes('حفص') && !r.style.includes('ورش') && !r.style.includes('قالون') && !r.style.includes('الدوري') && !r.style.includes('السوسي') && !r.style.includes('مجود') && !r.style.includes('المعلم');
                  }
                  return true;
                });

                if (filteredList.length === 0) {
                  return (
                    <div className="col-span-full py-12 text-center text-slate-400">
                      <Users size={36} className="mx-auto mb-2 opacity-40 text-amber-500" />
                      <p className="font-semibold text-sm">لم نجد أي قارئ يطابق بحثك</p>
                      <p className="text-xs text-slate-500 mt-1">جرب البحث بكلمة أخرى أو تغيير تصنيف الرواية</p>
                    </div>
                  );
                }

                return filteredList.map(r => {
                  const isSelected = selectedReciter === r.id;
                  
                  let styleBadgeColor = "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800";
                  if (r.style.includes('ورش')) {
                    styleBadgeColor = "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800";
                  } else if (r.style.includes('قالون')) {
                    styleBadgeColor = "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/80 dark:text-sky-300 dark:border-sky-800";
                  } else if (r.style.includes('مجود') || r.style.includes('مجوّد')) {
                    styleBadgeColor = "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-800";
                  } else if (r.style.includes('المعلم')) {
                    styleBadgeColor = "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800";
                  } else if (r.style.includes('الدوري') || r.style.includes('السوسي')) {
                    styleBadgeColor = "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/80 dark:text-indigo-300 dark:border-indigo-800";
                  }

                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setSelectedReciter(r.id);
                        setIsReciterModalOpen(false);
                      }}
                      className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 shadow-sm ring-2 ring-amber-500/40'
                          : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-50/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-amber-100 leading-snug">
                          {r.name}
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center shrink-0">
                            <Check size={12} />
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-1 mt-1 pt-1 border-t border-slate-100 dark:border-slate-700/50 text-[10px]">
                        <span className={`px-2 py-0.5 rounded-full border font-semibold truncate ${styleBadgeColor}`}>
                          {r.style}
                        </span>
                        <span className="text-slate-400 font-sans shrink-0">
                          {r.surahTotal || 114} سورة
                        </span>
                      </div>
                    </button>
                  );
                });
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>إجمالي القراء والمصاحف: {allReciters.length}</span>
              <button
                type="button"
                onClick={() => setIsReciterModalOpen(false)}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-colors"
              >
                إغلاق
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
