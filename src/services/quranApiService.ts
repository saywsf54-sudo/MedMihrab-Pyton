// Quran & Islamic Text Smart API Fetcher Service

export interface SurahMeta {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: 'Meccan' | 'Medinan';
}

export const QURAN_SURAHS_META: SurahMeta[] = [
  { number: 1, name: "الفاتحة", englishName: "Al-Fatiha", englishNameTranslation: "The Opening", numberOfAyahs: 7, revelationType: "Meccan" },
  { number: 2, name: "البقرة", englishName: "Al-Baqarah", englishNameTranslation: "The Cow", numberOfAyahs: 286, revelationType: "Medinan" },
  { number: 3, name: "آل عمران", englishName: "Aal-Imran", englishNameTranslation: "The Family of Imran", numberOfAyahs: 200, revelationType: "Medinan" },
  { number: 4, name: "النساء", englishName: "An-Nisa'", englishNameTranslation: "The Women", numberOfAyahs: 176, revelationType: "Medinan" },
  { number: 5, name: "المائدة", englishName: "Al-Ma'idah", englishNameTranslation: "The Table Spread", numberOfAyahs: 120, revelationType: "Medinan" },
  { number: 6, name: "الأنعام", englishName: "Al-An'am", englishNameTranslation: "The Cattle", numberOfAyahs: 165, revelationType: "Meccan" },
  { number: 7, name: "الأعراف", englishName: "Al-A'raf", englishNameTranslation: "The Heights", numberOfAyahs: 206, revelationType: "Meccan" },
  { number: 8, name: "الأنفال", englishName: "Al-Anfal", englishNameTranslation: "The Spoils of War", numberOfAyahs: 75, revelationType: "Medinan" },
  { number: 9, name: "التوبة", englishName: "At-Tawbah", englishNameTranslation: "The Repentance", numberOfAyahs: 129, revelationType: "Medinan" },
  { number: 10, name: "يونس", englishName: "Yunus", englishNameTranslation: "Jonah", numberOfAyahs: 109, revelationType: "Meccan" },
  { number: 11, name: "هود", englishName: "Hud", englishNameTranslation: "Hud", numberOfAyahs: 123, revelationType: "Meccan" },
  { number: 12, name: "يوسف", englishName: "Yusuf", englishNameTranslation: "Joseph", numberOfAyahs: 111, revelationType: "Meccan" },
  { number: 13, name: "الرعد", englishName: "Ar-Ra'd", englishNameTranslation: "The Thunder", numberOfAyahs: 43, revelationType: "Medinan" },
  { number: 14, name: "إبراهيم", englishName: "Ibrahim", englishNameTranslation: "Abraham", numberOfAyahs: 52, revelationType: "Meccan" },
  { number: 15, name: "الحجر", englishName: "Al-Hijr", englishNameTranslation: "The Rocky Tract", numberOfAyahs: 99, revelationType: "Meccan" },
  { number: 16, name: "النحل", englishName: "An-Nahl", englishNameTranslation: "The Bee", numberOfAyahs: 128, revelationType: "Meccan" },
  { number: 17, name: "الإسراء", englishName: "Al-Isra'", englishNameTranslation: "The Night Journey", numberOfAyahs: 111, revelationType: "Meccan" },
  { number: 18, name: "الكهف", englishName: "Al-Kahf", englishNameTranslation: "The Cave", numberOfAyahs: 110, revelationType: "Meccan" },
  { number: 19, name: "مريم", englishName: "Maryam", englishNameTranslation: "Mary", numberOfAyahs: 98, revelationType: "Meccan" },
  { number: 20, name: "طه", englishName: "Taha", englishNameTranslation: "Ta-Ha", numberOfAyahs: 135, revelationType: "Meccan" },
  { number: 21, name: "الأنبياء", englishName: "Al-Anbiya'", englishNameTranslation: "The Prophets", numberOfAyahs: 112, revelationType: "Meccan" },
  { number: 22, name: "الحج", englishName: "Al-Hajj", englishNameTranslation: "The Pilgrimage", numberOfAyahs: 78, revelationType: "Medinan" },
  { number: 23, name: "المؤمنون", englishName: "Al-Mu'minun", englishNameTranslation: "The Believers", numberOfAyahs: 118, revelationType: "Meccan" },
  { number: 24, name: "النور", englishName: "An-Nur", englishNameTranslation: "The Light", numberOfAyahs: 64, revelationType: "Medinan" },
  { number: 25, name: "الفرقان", englishName: "Al-Furqan", englishNameTranslation: "The Criterion", numberOfAyahs: 77, revelationType: "Meccan" },
  { number: 26, name: "الشعراء", englishName: "Ash-Shu'ara'", englishNameTranslation: "The Poets", numberOfAyahs: 227, revelationType: "Meccan" },
  { number: 27, name: "النمل", englishName: "An-Naml", englishNameTranslation: "The Ant", numberOfAyahs: 93, revelationType: "Meccan" },
  { number: 28, name: "القصص", englishName: "Al-Qasas", englishNameTranslation: "The Stories", numberOfAyahs: 88, revelationType: "Meccan" },
  { number: 29, name: "العنكبوت", englishName: "Al-Ankabut", englishNameTranslation: "The Spider", numberOfAyahs: 69, revelationType: "Meccan" },
  { number: 30, name: "الروم", englishName: "Ar-Rum", englishNameTranslation: "The Romans", numberOfAyahs: 60, revelationType: "Meccan" },
  { number: 31, name: "لقمان", englishName: "Luqman", englishNameTranslation: "Luqman", numberOfAyahs: 34, revelationType: "Meccan" },
  { number: 32, name: "السجدة", englishName: "As-Sajdah", englishNameTranslation: "The Prostration", numberOfAyahs: 30, revelationType: "Meccan" },
  { number: 33, name: "الأحزاب", englishName: "Al-Ahzab", englishNameTranslation: "The Combined Forces", numberOfAyahs: 73, revelationType: "Medinan" },
  { number: 34, name: "سبأ", englishName: "Saba'", englishNameTranslation: "Sheba", numberOfAyahs: 54, revelationType: "Meccan" },
  { number: 35, name: "فاطر", englishName: "Fatir", englishNameTranslation: "Originator", numberOfAyahs: 45, revelationType: "Meccan" },
  { number: 36, name: "يس", englishName: "Ya-Sin", englishNameTranslation: "Ya Sin", numberOfAyahs: 83, revelationType: "Meccan" },
  { number: 37, name: "الصافات", englishName: "As-Saffat", englishNameTranslation: "Those who set the Ranks", numberOfAyahs: 182, revelationType: "Meccan" },
  { number: 38, name: "ص", englishName: "Sad", englishNameTranslation: "Sad", numberOfAyahs: 88, revelationType: "Meccan" },
  { number: 39, name: "الزمر", englishName: "Az-Zumar", englishNameTranslation: "The Troops", numberOfAyahs: 75, revelationType: "Meccan" },
  { number: 40, name: "غافر", englishName: "Ghafir", englishNameTranslation: "The Forgiver", numberOfAyahs: 85, revelationType: "Meccan" },
  { number: 41, name: "فصلت", englishName: "Fussilat", englishNameTranslation: "Explained in Detail", numberOfAyahs: 54, revelationType: "Meccan" },
  { number: 42, name: "الشورى", englishName: "Ash-Shura", englishNameTranslation: "The Consultation", numberOfAyahs: 53, revelationType: "Meccan" },
  { number: 43, name: "الزخرف", englishName: "Az-Zukhruf", englishNameTranslation: "The Ornaments of Gold", numberOfAyahs: 89, revelationType: "Meccan" },
  { number: 44, name: "الدخان", englishName: "Ad-Dukhan", englishNameTranslation: "The Smoke", numberOfAyahs: 59, revelationType: "Meccan" },
  { number: 45, name: "الجاثية", englishName: "Al-Jathiyah", englishNameTranslation: "The Crouching", numberOfAyahs: 37, revelationType: "Meccan" },
  { number: 46, name: "الأحقاف", englishName: "Al-Ahqaf", englishNameTranslation: "The Wind-Curved Sandhills", numberOfAyahs: 35, revelationType: "Meccan" },
  { number: 47, name: "محمد", englishName: "Muhammad", englishNameTranslation: "Muhammad", numberOfAyahs: 38, revelationType: "Medinan" },
  { number: 48, name: "الفتح", englishName: "Al-Fath", englishNameTranslation: "The Victory", numberOfAyahs: 29, revelationType: "Medinan" },
  { number: 49, name: "الحجرات", englishName: "Al-Hujurat", englishNameTranslation: "The Dwellings", numberOfAyahs: 18, revelationType: "Medinan" },
  { number: 50, name: "ق", englishName: "Qaf", englishNameTranslation: "Qaf", numberOfAyahs: 45, revelationType: "Meccan" },
  { number: 51, name: "الذاريات", englishName: "Adh-Dhariyat", englishNameTranslation: "The Winnowing Winds", numberOfAyahs: 60, revelationType: "Meccan" },
  { number: 52, name: "الطور", englishName: "At-Tur", englishNameTranslation: "The Mount", numberOfAyahs: 49, revelationType: "Meccan" },
  { number: 53, name: "النجم", englishName: "An-Najm", englishNameTranslation: "The Star", numberOfAyahs: 62, revelationType: "Meccan" },
  { number: 54, name: "القمر", englishName: "Al-Qamar", englishNameTranslation: "The Moon", numberOfAyahs: 55, revelationType: "Meccan" },
  { number: 55, name: "الرحمن", englishName: "Ar-Rahman", englishNameTranslation: "The Beneficent", numberOfAyahs: 78, revelationType: "Medinan" },
  { number: 56, name: "الواقعة", englishName: "Al-Waqi'ah", englishNameTranslation: "The Inevitable", numberOfAyahs: 96, revelationType: "Meccan" },
  { number: 57, name: "الحديد", englishName: "Al-Hadid", englishNameTranslation: "The Iron", numberOfAyahs: 29, revelationType: "Medinan" },
  { number: 58, name: "المجادلة", englishName: "Al-Mujadila", englishNameTranslation: "The Pleading Woman", numberOfAyahs: 22, revelationType: "Medinan" },
  { number: 59, name: "الحشر", englishName: "Al-Hashr", englishNameTranslation: "The Exile", numberOfAyahs: 24, revelationType: "Medinan" },
  { number: 60, name: "الممتحنة", englishName: "Al-Mumtahanah", englishNameTranslation: "She that is to be examined", numberOfAyahs: 13, revelationType: "Medinan" },
  { number: 61, name: "الصف", englishName: "As-Saff", englishNameTranslation: "The Ranks", numberOfAyahs: 14, revelationType: "Medinan" },
  { number: 62, name: "الجمعة", englishName: "Al-Jumu'ah", englishNameTranslation: "The Congregation", numberOfAyahs: 11, revelationType: "Medinan" },
  { number: 63, name: "المنافقون", englishName: "Al-Munafiqun", englishNameTranslation: "The Hypocrites", numberOfAyahs: 11, revelationType: "Medinan" },
  { number: 64, name: "التغابن", englishName: "At-Taghabun", englishNameTranslation: "The Mutual Disillusion", numberOfAyahs: 18, revelationType: "Medinan" },
  { number: 65, name: "الطلاق", englishName: "At-Talaq", englishNameTranslation: "The Divorce", numberOfAyahs: 12, revelationType: "Medinan" },
  { number: 66, name: "التحريم", englishName: "At-Tahrim", englishNameTranslation: "The Prohibition", numberOfAyahs: 12, revelationType: "Medinan" },
  { number: 67, name: "الملك", englishName: "Al-Mulk", englishNameTranslation: "The Sovereignty", numberOfAyahs: 30, revelationType: "Meccan" },
  { number: 68, name: "القلم", englishName: "Al-Qalam", englishNameTranslation: "The Pen", numberOfAyahs: 52, revelationType: "Meccan" },
  { number: 69, name: "الحاقة", englishName: "Al-Haqqah", englishNameTranslation: "The Inevitable Reality", numberOfAyahs: 52, revelationType: "Meccan" },
  { number: 70, name: "المعارج", englishName: "Al-Ma'arij", englishNameTranslation: "The Ascending Stairways", numberOfAyahs: 44, revelationType: "Meccan" },
  { number: 71, name: "نوح", englishName: "Nuh", englishNameTranslation: "Noah", numberOfAyahs: 28, revelationType: "Meccan" },
  { number: 72, name: "الجن", englishName: "Al-Jinn", englishNameTranslation: "The Jinn", numberOfAyahs: 28, revelationType: "Meccan" },
  { number: 73, name: "المزمل", englishName: "Al-Muzzammil", englishNameTranslation: "The Enshrouded One", numberOfAyahs: 20, revelationType: "Meccan" },
  { number: 74, name: "المدثر", englishName: "Al-Muddaththir", englishNameTranslation: "The Cloaked One", numberOfAyahs: 56, revelationType: "Meccan" },
  { number: 75, name: "القيامة", englishName: "Al-Qiyamah", englishNameTranslation: "The Resurrection", numberOfAyahs: 40, revelationType: "Meccan" },
  { number: 76, name: "الإنسان", englishName: "Al-Insan", englishNameTranslation: "Man", numberOfAyahs: 31, revelationType: "Medinan" },
  { number: 77, name: "المرسلات", englishName: "Al-Mursalat", englishNameTranslation: "The Emissaries", numberOfAyahs: 50, revelationType: "Meccan" },
  { number: 78, name: "النبأ", englishName: "An-Naba'", englishNameTranslation: "The Tidings", numberOfAyahs: 40, revelationType: "Meccan" },
  { number: 79, name: "النازعات", englishName: "An-Nazi'at", englishNameTranslation: "Those who drag forth", numberOfAyahs: 46, revelationType: "Meccan" },
  { number: 80, name: "عبس", englishName: "Abasa", englishNameTranslation: "He Frowned", numberOfAyahs: 42, revelationType: "Meccan" },
  { number: 81, name: "التكوير", englishName: "At-Takwir", englishNameTranslation: "The Overthrowing", numberOfAyahs: 29, revelationType: "Meccan" },
  { number: 82, name: "الانفطار", englishName: "Al-Infitar", englishNameTranslation: "The Cleaving", numberOfAyahs: 19, revelationType: "Meccan" },
  { number: 83, name: "المطففين", englishName: "Al-Mutaffifin", englishNameTranslation: "The Defrauding", numberOfAyahs: 36, revelationType: "Meccan" },
  { number: 84, name: "الانشقاق", englishName: "Al-Inshiqaq", englishNameTranslation: "The Sundering", numberOfAyahs: 25, revelationType: "Meccan" },
  { number: 85, name: "البروج", englishName: "Al-Buruj", englishNameTranslation: "The Mansions of the Stars", numberOfAyahs: 22, revelationType: "Meccan" },
  { number: 86, name: "الطارق", englishName: "At-Tariq", englishNameTranslation: "The Morning Star", numberOfAyahs: 17, revelationType: "Meccan" },
  { number: 87, name: "الأعلى", englishName: "Al-A'la", englishNameTranslation: "The Most High", numberOfAyahs: 19, revelationType: "Meccan" },
  { number: 88, name: "الغاشية", englishName: "Al-Ghashiyah", englishNameTranslation: "The Overwhelming", numberOfAyahs: 26, revelationType: "Meccan" },
  { number: 89, name: "الفجر", englishName: "Al-Fajr", englishNameTranslation: "The Dawn", numberOfAyahs: 30, revelationType: "Meccan" },
  { number: 90, name: "البلد", englishName: "Al-Balad", englishNameTranslation: "The City", numberOfAyahs: 20, revelationType: "Meccan" },
  { number: 91, name: "الشمس", englishName: "Ash-Shams", englishNameTranslation: "The Sun", numberOfAyahs: 15, revelationType: "Meccan" },
  { number: 92, name: "الليل", englishName: "Al-Layl", englishNameTranslation: "The Night", numberOfAyahs: 21, revelationType: "Meccan" },
  { number: 93, name: "الضحى", englishName: "Ad-Duhaa", englishNameTranslation: "The Morning Hours", numberOfAyahs: 11, revelationType: "Meccan" },
  { number: 94, name: "الشرح", englishName: "Ash-Sharh", englishNameTranslation: "The Relief", numberOfAyahs: 8, revelationType: "Meccan" },
  { number: 95, name: "التين", englishName: "At-Tin", englishNameTranslation: "The Fig", numberOfAyahs: 8, revelationType: "Meccan" },
  { number: 96, name: "العلق", englishName: "Al-Alaq", englishNameTranslation: "The Clot", numberOfAyahs: 19, revelationType: "Meccan" },
  { number: 97, name: "القدر", englishName: "Al-Qadr", englishNameTranslation: "The Power", numberOfAyahs: 5, revelationType: "Meccan" },
  { number: 98, name: "البينة", englishName: "Al-Bayyinah", englishNameTranslation: "The Clear Proof", numberOfAyahs: 8, revelationType: "Medinan" },
  { number: 99, name: "الزلزلة", englishName: "Az-Zalzalah", englishNameTranslation: "The Earthquake", numberOfAyahs: 8, revelationType: "Medinan" },
  { number: 100, name: "العاديات", englishName: "Al-Adiyat", englishNameTranslation: "The Courser", numberOfAyahs: 11, revelationType: "Meccan" },
  { number: 101, name: "القارعة", englishName: "Al-Qari'ah", englishNameTranslation: "The Calamity", numberOfAyahs: 11, revelationType: "Meccan" },
  { number: 102, name: "التكاثر", englishName: "At-Takathur", englishNameTranslation: "The Rivalry in world increase", numberOfAyahs: 8, revelationType: "Meccan" },
  { number: 103, name: "العصر", englishName: "Al-Asr", englishNameTranslation: "The Declining Day", numberOfAyahs: 3, revelationType: "Meccan" },
  { number: 104, name: "الهمزة", englishName: "Al-Humazah", englishNameTranslation: "The Traducer", numberOfAyahs: 9, revelationType: "Meccan" },
  { number: 105, name: "الفيل", englishName: "Al-Fil", englishNameTranslation: "The Elephant", numberOfAyahs: 5, revelationType: "Meccan" },
  { number: 106, name: "قريش", englishName: "Quraysh", englishNameTranslation: "Quraysh", numberOfAyahs: 4, revelationType: "Meccan" },
  { number: 107, name: "الماعون", englishName: "Al-Ma'un", englishNameTranslation: "The Small Kindnesses", numberOfAyahs: 7, revelationType: "Meccan" },
  { number: 108, name: "الكوثر", englishName: "Al-Kawthar", englishNameTranslation: "The Abundance", numberOfAyahs: 3, revelationType: "Meccan" },
  { number: 109, name: "الكافرون", englishName: "Al-Kafirun", englishNameTranslation: "The Disbelievers", numberOfAyahs: 6, revelationType: "Meccan" },
  { number: 110, name: "النصر", englishName: "An-Nasr", englishNameTranslation: "The Divine Support", numberOfAyahs: 3, revelationType: "Medinan" },
  { number: 111, name: "المسد", englishName: "Al-Masad", englishNameTranslation: "The Palm Fiber", numberOfAyahs: 5, revelationType: "Meccan" },
  { number: 112, name: "الإخلاص", englishName: "Al-Ikhlas", englishNameTranslation: "The Sincerity", numberOfAyahs: 4, revelationType: "Meccan" },
  { number: 113, name: "الفلق", englishName: "Al-Falaq", englishNameTranslation: "The Daybreak", numberOfAyahs: 5, revelationType: "Meccan" },
  { number: 114, name: "الناس", englishName: "An-Nas", englishNameTranslation: "Mankind", numberOfAyahs: 6, revelationType: "Meccan" }
];

export const HADITH_BOOKS = [
  { id: 'bukhari', name: 'صحيح البخاري', total: 7563 },
  { id: 'muslim', name: 'صحيح مسلم', total: 7533 },
  { id: 'abudawud', name: 'سنن أبي داود', total: 5274 },
  { id: 'tirmidhi', name: 'جامع الترمذي', total: 3956 },
  { id: 'nasai', name: 'سنن النسائي', total: 5758 },
  { id: 'ibnmajah', name: 'سنن ابن ماجه', total: 4341 },
];

export const QURAN_EDITIONS = [
  { id: 'ar.uthmani', name: 'الرسم العثماني (المصحف الشريف)' },
  { id: 'ar.warsh', name: 'رواية ورش عن نافع' },
  { id: 'ar.alafasy', name: 'النص المشكول (العفاسي)' },
  { id: 'ar.saoodshuraym', name: 'المصحف الميسر (الشريم)' },
  { id: 'en.sahih', name: 'الترجمة الإنجليزية (Saheeh International)' }
];

export interface QuranReciter {
  id: string;
  name: string;
  englishName?: string;
  style: string;
  server?: string;
  surahList?: number[];
  surahTotal?: number;
  rewayaId?: number;
  reciterId?: number;
  isMp3Quran?: boolean;
}

export const BASE_ISLAMIC_NETWORK_RECITERS: QuranReciter[] = [
  { id: 'ar.alafasy', name: 'الشيخ مشاري راشد العفاسي', englishName: 'Mishary Rashid Alafasy', style: 'حفص عن عاصم - مرتل' },
  { id: 'ar.abdulbasitmurattal', name: 'الشيخ عبد الباسط عبد الصمد (مرتل)', englishName: 'Abdul Basit (Murattal)', style: 'حفص عن عاصم - مرتل' },
  { id: 'ar.abdulbasitmujawwad', name: 'الشيخ عبد الباسط عبد الصمد (مجوّد)', englishName: 'Abdul Basit (Mujawwad)', style: 'المصحف المجود' },
  { id: 'ar.minshawi', name: 'الشيخ محمد صديق المنشاوي (مرتل)', englishName: 'Minshawi (Murattal)', style: 'حفص عن عاصم - مرتل' },
  { id: 'ar.minshawimujawwad', name: 'الشيخ محمد صديق المنشاوي (مجوّد)', englishName: 'Minshawi (Mujawwad)', style: 'المصحف المجود' },
  { id: 'ar.husary', name: 'الشيخ محمود خليل الحصري', englishName: 'Mahmoud Khalil Al-Husary', style: 'حفص عن عاصم - مرتل' },
  { id: 'ar.husarymujawwad', name: 'الشيخ محمود خليل الحصري (مجوّد)', englishName: 'Al-Husary (Mujawwad)', style: 'المصحف المجود' },
  { id: 'ar.hudhaify', name: 'الشيخ علي بن عبد الرحمن الحذيفي', englishName: 'Ali Al-Hudhaify', style: 'حفص عن عاصم - مرتل' },
  { id: 'ar.saoodshuraym', name: 'الشيخ سعود الشريم', englishName: 'Saood Al-Shuraym', style: 'حفص عن عاصم - مرتل' },
  { id: 'ar.sudais', name: 'الشيخ عبد الرحمن السدیس', englishName: 'Abdur-Rahman As-Sudais', style: 'حفص عن عاصم - مرتل' },
  { id: 'ar.mahermuaiqly', name: 'الشيخ ماهر المعيقلي', englishName: 'Maher Al Muaiqly', style: 'حفص عن عاصم - مرتل' },
  { id: 'ar.ghamadi', name: 'الشيخ سعد الغامدي', englishName: 'Saad Al-Ghamdi', style: 'حفص عن عاصم - مرتل' },
  { id: 'ar.shaatree', name: 'الشيخ أبو بكر الشاطري', englishName: 'Abu Bakr Al-Shatri', style: 'حفص عن عاصم - مرتل' },
  { id: 'ar.muhammadayyoub', name: 'الشيخ محمد أيوب', englishName: 'Muhammad Ayyoub', style: 'حفص عن عاصم - مرتل' },
  { id: 'ar.hanrifai', name: 'الشيخ هاني الرفاعي', englishName: 'Hani Ar-Rifai', style: 'حفص عن عاصم - مرتل' },
  { id: 'ar.parhizgar', name: 'الشيخ شهريار برهيزكار', englishName: 'Parhizgar', style: 'تلاوة تعليمية' },
];

let dynamicRecitersCache: QuranReciter[] = [...BASE_ISLAMIC_NETWORK_RECITERS];

// Try reading cached reciters from localStorage
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = localStorage.getItem('quran_dynamic_reciters_v3');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        dynamicRecitersCache = parsed;
      }
    }
  }
} catch (e) {
  console.warn("Could not load reciters cache from localStorage:", e);
}

export const QURAN_RECITERS: QuranReciter[] = new Proxy(BASE_ISLAMIC_NETWORK_RECITERS, {
  get(_target, prop, receiver) {
    if (prop === 'length') return dynamicRecitersCache.length;
    if (typeof prop === 'string' && !isNaN(Number(prop))) {
      return dynamicRecitersCache[Number(prop)];
    }
    if (prop === 'map') return dynamicRecitersCache.map.bind(dynamicRecitersCache);
    if (prop === 'find') return dynamicRecitersCache.find.bind(dynamicRecitersCache);
    if (prop === 'filter') return dynamicRecitersCache.filter.bind(dynamicRecitersCache);
    if (prop === 'forEach') return dynamicRecitersCache.forEach.bind(dynamicRecitersCache);
    if (prop === 'slice') return dynamicRecitersCache.slice.bind(dynamicRecitersCache);
    return Reflect.get(dynamicRecitersCache, prop, receiver);
  }
});

/**
 * Live fetcher from MP3Quran v3 API
 * Scans all 240+ reciters and 280+ moshafs across 22 Rewayas
 */
export async function syncRecitersFromApi(): Promise<QuranReciter[]> {
  try {
    const url = 'https://mp3quran.net/api/v3/reciters?language=ar';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rawReciters = data?.reciters;
    if (!Array.isArray(rawReciters) || rawReciters.length === 0) {
      return dynamicRecitersCache;
    }

    const fetchedItems: QuranReciter[] = [];

    for (const r of rawReciters) {
      const rawName = (r.name || '').trim();
      const rId = r.id;
      const cleanName = rawName.startsWith('الشيخ') || rawName.startsWith('القارئ')
        ? rawName
        : `الشيخ ${rawName}`;

      if (Array.isArray(r.moshaf)) {
        for (const m of r.moshaf) {
          const mId = m.id;
          const styleName = (m.name || 'حفص عن عاصم - مرتل').trim();
          const serverUrl = (m.server || '').trim();
          const surahListStr = m.surah_list || '';
          let surahList: number[] = [];
          try {
            surahList = surahListStr.split(',').map((x: string) => parseInt(x.trim(), 10)).filter((n: number) => !isNaN(n));
          } catch(e) {
            surahList = Array.from({ length: 114 }, (_, i) => i + 1);
          }

          fetchedItems.push({
            id: `mp3q_${rId}_${mId}`,
            name: cleanName,
            englishName: r.letter || '',
            style: styleName,
            server: serverUrl,
            surahList: surahList.length > 0 ? surahList : Array.from({ length: 114 }, (_, i) => i + 1),
            surahTotal: surahList.length || 114,
            rewayaId: m.rewaya_id,
            reciterId: rId,
            isMp3Quran: true
          });
        }
      }
    }

    // Merge base Islamic Network reciters at the top, then MP3Quran reciters
    const mergedMap = new Map<string, QuranReciter>();
    for (const item of BASE_ISLAMIC_NETWORK_RECITERS) {
      mergedMap.set(item.id, item);
    }
    for (const item of fetchedItems) {
      mergedMap.set(item.id, item);
    }

    const mergedList = Array.from(mergedMap.values());
    dynamicRecitersCache = mergedList;

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('quran_dynamic_reciters_v3', JSON.stringify(mergedList));
        localStorage.setItem('quran_reciters_last_sync', new Date().toISOString());
      }
    } catch (e) {
      console.warn("Could not write reciters cache to localStorage:", e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('quran-reciters-updated', { detail: mergedList }));
    }

    console.log(`[Quran API] Synchronized ${mergedList.length} reciters & narrations from MP3Quran!`);
    return mergedList;
  } catch (e) {
    console.warn("[Quran API] Syncing reciters from API failed, using cached list:", e);
    return dynamicRecitersCache;
  }
}

export function getAvailableReciters(): QuranReciter[] {
  return dynamicRecitersCache;
}

export function findReciterById(id: string): QuranReciter {
  return dynamicRecitersCache.find(r => r.id === id) || dynamicRecitersCache[0] || BASE_ISLAMIC_NETWORK_RECITERS[0];
}

// Automatically initiate sync on module load
if (typeof window !== 'undefined') {
  setTimeout(() => {
    syncRecitersFromApi();
  }, 1000);
}

/**
 * Helper to resolve Surah number from name or number input (e.g. "سورة الأعلى", "الأعلى", "87", 87)
 */
export function findSurahByNameOrNumber(query: string | number): number {
  if (typeof query === 'number') {
    if (query >= 1 && query <= 114) return query;
  }
  const str = String(query || '').trim();
  const parsedNum = parseInt(str, 10);
  if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= 114) return parsedNum;

  const cleanQuery = str
    .replace(/^سورة\s+/, '')
    .replace(/^سورة/, '')
    .replace(/[أإآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[\u064B-\u065F]/g, '') // Remove tashkeel
    .trim()
    .toLowerCase();

  // Pass 1: Exact Arabic Name Match
  for (const s of QURAN_SURAHS_META) {
    const cleanName = s.name
      .replace(/[أإآا]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/[\u064B-\u065F]/g, '')
      .trim()
      .toLowerCase();
    if (cleanName === cleanQuery) {
      return s.number;
    }
  }

  // Pass 2: Word-level Exact Match (e.g., query "الذاريات (ق)" contains full word "الذاريات")
  const words = cleanQuery.match(/[\u0600-\u06FFa-zA-Z0-9]+/g) || [];
  for (const word of words) {
    for (const s of QURAN_SURAHS_META) {
      const cleanName = s.name
        .replace(/[أإآا]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/[\u064B-\u065F]/g, '')
        .trim()
        .toLowerCase();
      if (cleanName === word) {
        return s.number;
      }
    }
  }

  // Pass 3: English Exact / Prefix Match
  const cleanQueryEng = cleanQuery.replace(/[^a-z]/g, '');
  if (cleanQueryEng.length >= 2) {
    for (const s of QURAN_SURAHS_META) {
      const cleanEng = s.englishName.toLowerCase().replace(/[^a-z]/g, '');
      if (cleanEng === cleanQueryEng || cleanEng.startsWith(cleanQueryEng)) {
        return s.number;
      }
    }
  }

  // Pass 4: Substring Match ONLY for names with length >= 3
  for (const s of QURAN_SURAHS_META) {
    const cleanName = s.name
      .replace(/[أإآا]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/[\u064B-\u065F]/g, '')
      .trim()
      .toLowerCase();
    if (cleanName.length >= 3 && cleanQuery.length >= 3) {
      if (cleanName.includes(cleanQuery) || cleanQuery.includes(cleanName)) {
        return s.number;
      }
    }
  }

  return 1;
}

/**
 * Strips AlQuran Cloud Tajweed markup tags like [h:14437[i], [o|y], [g:n], [f:8555], [q:298]
 */
export function stripTajweedTags(text: string): string {
  if (!text) return '';
  return text.replace(/\[[a-zA-Z0-9_:|~#\-\.\s\d]*\]?/g, '').replace(/[\[\]]/g, '').replace(/\s+/g, ' ').trim();
}

const apiCache = new Map<string, any>();

/**
 * Direct API fetcher for Quran Surah
 */
export async function fetchSurahFromApi(surahIdentifier: number | string, edition: string = 'ar.uthmani') {
  try {
    const surahNumber = findSurahByNameOrNumber(surahIdentifier);
    const url = `https://api.alquran.cloud/v1/surah/${surahNumber}/${edition}`;
    
    if (apiCache.has(url)) {
      return apiCache.get(url);
    }
    
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rawData = await res.json();
    const data = rawData?.data;
    if (!data) return null;

    // Compact ayahs list to save tokens and avoid payload truncation
    const cleanAyahs = (data.ayahs || []).map((a: any) => ({
      numberInSurah: a.numberInSurah,
      text: stripTajweedTags(a.text)
    }));

    const finalResult = {
      number: data.number,
      name: data.name,
      englishName: data.englishName,
      numberOfAyahs: data.numberOfAyahs,
      revelationType: data.revelationType,
      ayahs: cleanAyahs
    };
    
    apiCache.set(url, finalResult);
    return finalResult;
  } catch (err: any) {
    console.error("Quran Surah Fetch Error:", err);
    throw new Error(`تعذر جلب السورة (${surahIdentifier}): ${err.message}`);
  }
}

/**
 * Direct API fetcher for Quran Ayah
 */
export async function fetchAyahFromApi(surahNumber: number, ayahNumber: number, edition: string = 'ar.uthmani') {
  try {
    const url = `https://api.alquran.cloud/v1/ayah/${surahNumber}:${ayahNumber}/${edition}`;
    if (apiCache.has(url)) return apiCache.get(url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const result = data?.data || null;
    if (result && result.text) {
      result.text = stripTajweedTags(result.text);
    }
    if (result) apiCache.set(url, result);
    return result;
  } catch (err: any) {
    console.error("Quran Ayah Fetch Error:", err);
    throw new Error(`تعذر جلب الآية ${surahNumber}:${ayahNumber}: ${err.message}`);
  }
}

/**
 * Direct API fetcher for Quran Audio and Recitations
 */
export async function fetchQuranAudioFromApi(surahIdentifier: number | string, reciterEdition: string = 'ar.alafasy', ayahNumber?: number) {
  try {
    const surahNumber = findSurahByNameOrNumber(surahIdentifier);
    const reciterObj = findReciterById(reciterEdition);

    let fullSurahAudioUrl = `https://cdn.islamic.network/quran/audio-surah/128/${reciterEdition}/${surahNumber}.mp3`;
    if (reciterObj && reciterObj.server) {
      const surahPadded = String(surahNumber).padStart(3, '0');
      fullSurahAudioUrl = `${reciterObj.server}${surahPadded}.mp3`;
    }

    if (ayahNumber) {
      // Try fetching ayah audio from AlQuran Cloud
      try {
        const cloudEdition = reciterEdition.startsWith('mp3q_') ? 'ar.alafasy' : reciterEdition;
        const url = `https://api.alquran.cloud/v1/ayah/${surahNumber}:${ayahNumber}/${cloudEdition}`;
        const res = await fetch(url);
        if (res.ok) {
          const rawData = await res.json();
          const data = rawData?.data;
          if (data) {
            return {
              surahNumber,
              ayahNumber,
              text: data.text,
              audioUrl: data.audio || data.audioSecondary?.[0],
              reciterName: `${reciterObj.name} (${reciterObj.style})`,
              surahName: data.surah?.name || `سورة ${surahNumber}`
            };
          }
        }
      } catch(e) {}
      
      return {
        surahNumber,
        ayahNumber,
        text: `الآية ${ayahNumber}`,
        audioUrl: fullSurahAudioUrl,
        reciterName: `${reciterObj.name} (${reciterObj.style})`,
        surahName: `سورة ${surahNumber}`
      };
    } else {
      let ayahsAudio: any[] = [];
      let surahName = `سورة ${surahNumber}`;
      let englishName = `Surah ${surahNumber}`;
      let numberOfAyahs = 0;

      try {
        const url = `https://api.alquran.cloud/v1/surah/${surahNumber}/ar.uthmani`;
        const res = await fetch(url);
        if (res.ok) {
          const rawData = await res.json();
          const data = rawData?.data;
          if (data) {
            surahName = data.name;
            englishName = data.englishName;
            numberOfAyahs = data.numberOfAyahs;
            ayahsAudio = (data.ayahs || []).map((a: any) => ({
              numberInSurah: a.numberInSurah,
              text: a.text,
              audio: null
            }));
          }
        }
      } catch (e) {
        console.warn("Could not fetch surah ayahs metadata:", e);
      }

      return {
        surahNumber,
        surahName,
        englishName,
        numberOfAyahs,
        reciterId: reciterEdition,
        reciterName: `${reciterObj.name} - ${reciterObj.style}`,
        fullSurahAudioUrl,
        ayahs: ayahsAudio
      };
    }
  } catch (err: any) {
    console.error("Quran Audio Fetch Error:", err);
    throw new Error(`تعذر جلب التلاوة الصوتية (${surahIdentifier}): ${err.message}`);
  }
}

/**
 * Direct API fetcher for Hadith
 */
export async function fetchHadithFromApi(book: string, number: number) {
  try {
    const url = `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-${book}/${number}.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data?.hadiths?.[0] || data || null;
  } catch (err: any) {
    console.error("Hadith Fetch Error:", err);
    throw new Error(`تعذر جلب الحديث من ${book} رقم ${number}: ${err.message}`);
  }
}

/**
 * Generates ready-to-use Python snippet for smart dynamic fetching
 */
export function generatePythonApiSnippet(
  type: 'surah' | 'ayah' | 'hadith' | 'custom_url',
  options: {
    surahNumber?: number;
    ayahNumber?: number;
    edition?: string;
    book?: string;
    hadithNumber?: number;
    customUrl?: string;
  }
): string {
  if (type === 'surah') {
    const sNum = options.surahNumber || 1;
    const ed = options.edition || 'ar.uthmani';
    const surahMeta = QURAN_SURAHS_META.find(s => s.number === sNum);
    const sName = surahMeta ? surahMeta.name : `سورة ${sNum}`;

    return `# ==============================================================
# كود بايثون للجلب الذكي عبر API المباشر (توفير التوكنات - Token Optimized)
# جلب ${sName} (${ed}) دون الحاجة لتخزين نص مطول داخل الكود
# ==============================================================
import json
import urllib.request
import re

def clean_tajweed(text):
    """تنظيف رموز التجويد البرمجية [h:14437[i] إن وجدت لضمان ظهور النص القرآني المشرق صافياً"""
    if not text: return ""
    cleaned = text
    for _ in range(3):
        cleaned = re.sub(r'\[[a-zA-Z0-9_:|~#\-\.\s]*\]?', '', cleaned)
    return re.sub(r'\s+', ' ', cleaned).strip()

def get_quran_surah(surah_num=${sNum}, edition='${ed}'):
    """جلب بيانات السورة القرآنية وآياتها مباشرة عبر الـ API"""
    url = f"https://api.alquran.cloud/v1/surah/{surah_num}/{edition}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    
    with urllib.request.urlopen(req) as response:
        if response.status == 200:
            result = json.loads(response.read().decode('utf-8'))
            return result.get('data', {})
        else:
            raise Exception(f"HTTP Error: {response.status}")

# تشغيل الجلب وعرض الإحصاءات والألفاظ
surah_data = get_quran_surah(${sNum}, '${ed}')
print(f"اسم السورة: {surah_data.get('name')} ({surah_data.get('englishName')})")
print(f"عدد الآيات: {surah_data.get('numberOfAyahs')} | نوع النزول: {surah_data.get('revelationType')}")
print("-" * 50)

# عرض الآيات مع تنظيف الرموز
all_text = ""
for idx, ayah in enumerate(surah_data.get('ayahs', []), 1):
    raw_text = ayah.get('text', '')
    text = clean_tajweed(raw_text)
    all_text += " " + text
    print(f"[{ayah.get('numberInSurah')}] {text}")

# إحصائيات سريعة للألفاظ والجُمل
words = all_text.split()
chars = len(all_text.replace(' ', ''))
print("=" * 50)
print(f"إجمالي الكلمات في السورة: {len(words)}")
print(f"إجمالي عدد الحروف (بدون مسافات): {chars}")
`;
  }

  if (type === 'ayah') {
    const sNum = options.surahNumber || 1;
    const aNum = options.ayahNumber || 1;
    const ed = options.edition || 'ar.uthmani';

    return `# ==============================================================
# جلب آية قرآنية محددة عبر الـ API (Smart Ayah Fetcher)
# ==============================================================
import json
import urllib.request

def get_quran_ayah(surah_num=${sNum}, ayah_num=${aNum}, edition='${ed}'):
    url = f"https://api.alquran.cloud/v1/ayah/{surah_num}:{ayah_num}/{edition}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode('utf-8')).get('data', {})

ayah_data = get_quran_ayah(${sNum}, ${aNum}, '${ed}')
print(f"السورة: {ayah_data.get('surah', {}).get('name')} | الآية: {ayah_data.get('numberInSurah')}")
print(f"النص: {ayah_data.get('text')}")
`;
  }

  if (type === 'hadith') {
    const book = options.book || 'bukhari';
    const hNum = options.hadithNumber || 1;

    return `# ==============================================================
# جلب الحديث الشريف ذكياً عبر الـ API (Hadith Smart Fetcher)
# ==============================================================
import json
import urllib.request

def get_hadith(book_id='${book}', hadith_num=${hNum}):
    url = f"https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-{book_id}/{hadith_num}.json"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode('utf-8'))

hadith_res = get_hadith('${book}', ${hNum})
hadiths = hadith_res.get('hadiths', [])
if hadiths:
    h = hadiths[0]
    print(f"الكتاب: {hadith_res.get('metadata', {}).get('name', '${book}')}")
    print(f"رقم الحديث: {h.get('hadithnumber')}")
    print(f"نص الحديث:\\n{h.get('text')}")
`;
  }

  // Custom URL Fetcher
  const url = options.customUrl || "https://api.allorigins.win/raw?url=https://example.com/data.json";
  return `# ==============================================================
# جلب بيانات من رابط API عام (Web Text & Data API Fetcher)
# ==============================================================
import json
import urllib.request

url = "${url}"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})

try:
    with urllib.request.urlopen(req) as response:
        content = response.read().decode('utf-8')
        print(f"حجم البيانات المجلوبة: {len(content)} حرف")
        print("بداية المخرجات:")
        print(content[:1000])
except Exception as e:
    print(f"حدث خطأ أثناء الجلب: {e}")
`;
}
