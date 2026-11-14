export interface CodeSnippet {
  id: string;
  title: string;
  category: string;
  description: string;
  code: string;
}

export const CODE_SNIPPETS: CodeSnippet[] = [
  {
    id: 'quran-analytics',
    title: 'تحليل تكرار كلمات النص القرآني',
    category: 'العلوم الإسلامية واللغوية',
    description: 'برنامج بايثون لتحليل التكرار الإحصائي ورسم التوزيع التكراري للكلمات.',
    code: `# -*- coding: utf-8 -*-
import matplotlib.pyplot as plt
from collections import Counter
import re

# نص من سورة الفاتحة المباركة
quran_text = """
بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ
الرَّحْمَٰنِ الرَّحِيمِ
مَالِكِ يَوْمِ الدِّينِ
إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ
اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ
صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ
"""

# إزالة التشكيل وعلامات الضبط والوقف للتحليل الإحصائي الدقيق
def remove_tashkeel(text):
    text = re.sub(r'[\s\u200a]+(?=\u0670)', '', text)
    tashkeel_pattern = re.compile(r'[\u0610-\u061A\u0640\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF\u200a\u200b-\u200d\u2060\ufeff]')
    text = re.sub(tashkeel_pattern, '', text)
    return text.replace('ی', 'ي')

clean_text = remove_tashkeel(quran_text)
words = [w.strip() for w in clean_text.split() if w.strip()]

word_counts = Counter(words)
print("--- إحصائيات الكلمات في سورة الفاتحة ---")
print(f"إجمالي عدد الكلمات: {len(words)}")
print(f"عدد الكلمات الفريدة: {len(word_counts)}")
print("\\nأكثر الكلمات تكراراً:")
for word, count in word_counts.most_common(5):
    print(f"الكلمة: '{word}' -> التكرار: {count}")

# رسم بياني لأكثر 6 كلمات تكراراً
top_words = word_counts.most_common(6)
labels = [item[0] for item in top_words]
values = [item[1] for item in top_words]

plt.figure(figsize=(8, 4))
plt.bar(range(len(labels)), values, color='#2563eb')
plt.title('Top Word Frequency in Surah Al-Fatiha', fontsize=12, fontweight='bold')
plt.xlabel('Words')
plt.ylabel('Occurrences')
plt.tight_layout()
plt.show()
`
  },
  {
    id: 'qibla-calculation',
    title: 'حساب زاوية القبلة والمسافة للكعبة المشرفة',
    category: 'العلوم الفلكية والحسابية',
    description: 'حساب دقيق لاتجاه القبلة الجغرافي بالدرجات ومسافة القوس العظيم.',
    code: `import math

# إحداثيات الكعبة المشرفة بمكة المكرمة
KAABA_LAT = math.radians(21.4225)
KAABA_LON = math.radians(39.8262)

def calculate_qibla(user_lat_deg, user_lon_deg):
    user_lat = math.radians(user_lat_deg)
    user_lon = math.radians(user_lon_deg)
    
    delta_lon = KAABA_LON - user_lon
    
    y = math.sin(delta_lon)
    x = math.cos(user_lat) * math.tan(KAABA_LAT) - math.sin(user_lat) * math.cos(delta_lon)
    
    qibla_rad = math.atan2(y, x)
    qibla_deg = (math.degrees(qibla_rad) + 360) % 360
    
    # حساب المسافة التقريبية بال километرات (Earth radius ~ 6371 km)
    dlat = KAABA_LAT - user_lat
    dlon = KAABA_LON - user_lon
    a = math.sin(dlat/2)**2 + math.cos(user_lat) * math.cos(KAABA_LAT) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    distance_km = 6371 * c
    
    return qibla_deg, distance_km

# مثال: حساب القبلة من القاهرة (30.0444° N, 31.2357° E)
city_name = "القاهرة"
lat, lon = 30.0444, 31.2357

bearing, dist = calculate_qibla(lat, lon)

print(f"=== حساب اتجاه القبلة من مدينة {city_name} ===")
print(f"إحداثيات المدينة: {lat}° N, {lon}° E")
print(f"اتجاه القبلة من الشمال الجغرافي: {bearing:.2f}°")
print(f"المسافة المباشرة إلى الكعبة: {dist:.1f} كم")
`
  },
  {
    id: 'data-plot-sine',
    title: 'تصوير بياني هندسي وموجات سينوسية',
    category: 'الرسم البياني والعلوم',
    description: 'توليد رسم بياني لموجات جيبية متعددة باستخدام Matplotlib.',
    code: `import numpy as np
import matplotlib.pyplot as plt

# توليد نقاط زامنية
x = np.linspace(0, 4 * np.pi, 200)
y1 = np.sin(x)
y2 = np.cos(x)
y3 = np.sin(x) * np.exp(-0.15 * x)

plt.figure(figsize=(9, 4.5), dpi=100)
plt.plot(x, y1, label='Sin(x)', color='#2563eb', linewidth=2)
plt.plot(x, y2, label='Cos(x)', color='#10b981', linewidth=2, linestyle='--')
plt.plot(x, y3, label='Damped Sin(x)', color='#f59e0b', linewidth=2)

plt.title('Mathematical Signal Oscillations', fontsize=12, fontweight='bold')
plt.xlabel('Time / Angle (radians)')
plt.ylabel('Amplitude')
plt.grid(True, linestyle=':', alpha=0.6)
plt.legend(loc='upper right')
plt.tight_layout()

# عرض الرسم البياني
plt.show()
`
  },
  {
    id: 'hisab-aljumal',
    title: 'حساب الجُمَّل الرقمي للكلمات العربية',
    category: 'العلوم اللغوية والإسلامية',
    description: 'حساب القيمة الحسابية للكلمات بالجدول التقليدي لحساب الجمل الكبير.',
    code: `# جدول حساب الجُمَّل الكبير أبجد هوز
JUMAL_MAP = {
    'أ': 1, 'ا': 1, 'إ': 1, 'آ': 1, 'ء': 1, 'ب': 2, 'ج': 3, 'د': 4,
    'ه': 5, 'و': 6, 'ز': 7, 'ح': 8, 'ط': 9, 'ي': 10, 'ى': 10,
    'ك': 20, 'ل': 30, 'م': 40, 'ن': 50, 'س': 60, 'ع': 70, 'ف': 80,
    'ص': 90, 'ق': 100, 'ر': 200, 'ش': 300, 'ت': 400, 'ث': 500, 'خ': 600,
    'ذ': 700, 'ض': 800, 'ظ': 900, 'غ': 1000, 'ة': 5
}

def calculate_jumal(phrase):
    total = 0
    breakdown = []
    for char in phrase:
        val = JUMAL_MAP.get(char, 0)
        if val > 0:
            total += val
            breakdown.append(f"{char}:{val}")
    return total, breakdown

text = "بسم الله الرحمن الرحيم"
score, details = calculate_jumal(text)

print(f"النص: '{text}'")
print(f"القيمة بحساب الجُمَّل الكبير: {score}")
print(f"تفاصيل الأحرف: {' + '.join(details)}")
`
  }
];
