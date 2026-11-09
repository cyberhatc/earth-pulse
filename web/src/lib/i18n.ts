// Minimal i18n: en shipped, hi/kn mirrored keys (i18n-ready).
// Keys are consumed by components via t('key'); extend TABLES for full translation.

export type Locale = 'en' | 'hi' | 'kn'

const TABLES: Record<Locale, Record<string, string>> = {
  en: {
    appName: 'Earth Pulse',
    tagline: 'Be an Earth System Trend Detective',
    clickHint: 'Click anywhere on the map to see how this place has changed',
    coverage: 'Data coverage',
    observed: 'Observed',
    forecast: 'Forecast (p10–p90)',
    scenario: 'AI-generated scenario',
    overview: 'Overview',
    charts: 'Charts',
    imagery: 'Imagery',
    opposite: 'Opposite Trends',
    why: 'Why?',
    watchlist: 'Watchlist',
    addWatch: 'Add to watchlist',
    removeWatch: 'Remove from watchlist',
    exportCsv: 'Export CSV',
    syntheticNote: 'Demo uses a synthetic sample store — swap in real NASA products for research.',
    uncertaintyNote: 'Forecast = probabilistic outlook (p10–p90 band), not a guaranteed future.',
    footerCredit: 'Data courtesy NASA Earthdata & partners',
    panelTitle: 'Place briefing',
    panelHint: 'Click the map to inspect a place',
    tabOverview: 'Overview',
    tabImagery: 'Imagery',
    tabOpposite: 'Opposite Trends',
    tabWhy: 'Why',
    offlineLoad: 'Load offline sample',
    offlineBanner: 'Offline sample fixture — synthetic demo data, not the clicked location.',
    offlineRetry: 'Retry live API',
    offlineHide: 'Hide sample',
    errorTitle: 'Couldn’t load this place.',
    showSample: 'Show sample payload',
    retry: 'Retry',
    loading: 'Loading place briefing…',
    noCoverage: 'No coverage for this parameter at this location/period.',
    rawValues: 'Raw values',
    hideRawValues: 'Hide raw values',
  },
  hi: {
    appName: 'अर्थ पल्स',
    tagline: 'पृथ्वी की बदलती तस्वीर के पड़तालकर्ता बनें',
    clickHint: 'इस जगह में क्या बदला है, यह देखने के लिए मानचित्र पर कहीं भी क्लिक करें',
    coverage: 'डेटा की उपलब्धता',
    observed: 'प्रेक्षित',
    forecast: 'पूर्वानुमान (p10–p90)',
    scenario: 'AI-जनित परिदृश्य',
    overview: 'सारांश',
    charts: 'चार्ट',
    imagery: 'चित्र',
    opposite: 'विपरीत रुझान',
    why: 'क्यों?',
    watchlist: 'वॉचलिस्ट',
    addWatch: 'वॉचलिस्ट में जोड़ें',
    removeWatch: 'वॉचलिस्ट से हटाएं',
    exportCsv: 'CSV डाउनलोड',
    syntheticNote: 'डेमो सिंथेटिक नमूना स्टोर उपयोग करता है — शोध हेतु वास्तविक NASA डेटा जोड़ें।',
    uncertaintyNote: 'पूर्वानुमान प्रायिकता आधारित है (p10–p90 बैंड), निश्चित भविष्य नहीं।',
    footerCredit: 'डेटा सौजन्य: NASA Earthdata एवं साझेदार',
    panelTitle: 'स्थान विवरण',
    panelHint: 'किसी स्थान को देखने के लिए मानचित्र पर क्लिक करें',
    tabOverview: 'सारांश',
    tabImagery: 'चित्र',
    tabOpposite: 'विपरीत रुझान',
    tabWhy: 'क्यों?',
    offlineLoad: 'ऑफ़लाइन नमूना लोड करें',
    offlineBanner: 'ऑफ़लाइन नमूना फ़िक्स्चर — सिंथेटिक डेमो डेटा, क्लिक किया गया स्थान नहीं।',
    offlineRetry: 'लाइव API फिर कोशिश करें',
    offlineHide: 'नमूना छिपाएं',
    errorTitle: 'यह स्थान लोड नहीं हो सका।',
    showSample: 'नमूना पेलोड दिखाएं',
    retry: 'पुनः प्रयास',
    loading: 'स्थान विवरण लोड हो रहा है…',
    noCoverage: 'इस स्थान/अवधि के लिए इस पैरामीटर का कवरेज नहीं है।',
    rawValues: 'मूल मान',
    hideRawValues: 'मूल मान छिपाएं',
  },
  kn: {
    appName: 'ಎರ್ತ್ ಪಲ್ಸ್',
    tagline: 'ಭೂಮಿ ಬದಲಾವಣೆ ಪತ್ತೆ ಸಾಹಸಿ',
    clickHint: 'ಈ ಸ್ಥಳ ಹೇಗೆ ಬದಲಾಯಿತು ಎಂದು ನೋಡಲು ನಕ್ಷೆಯಲ್ಲಿ ಎಲ್ಲಿಯಾದರೂ ಕ್ಲಿಕ್ ಮಾಡಿ',
    coverage: 'ಡೇಟಾ ಲಭ್ಯತೆ',
    observed: 'ಗಮನಿಸಲಾಗಿದೆ',
    forecast: 'ಮುನ್ಸೂಚನೆ (p10–p90)',
    scenario: 'AI-ಸೃಷ್ಟಿ ಸನ್ನಿವೇಶ',
    overview: 'ಸಾರಾಂಶ',
    charts: 'ಚಾರ್ಟ್‌ಗಳು',
    imagery: 'ಚಿತ್ರಗಳು',
    opposite: 'ವಿರುದ್ಧ ಪ್ರವೃತ್ತಿಗಳು',
    why: 'ಯಾಕೆ?',
    watchlist: 'ವೀಕ್ಷಣಾ ಪಟ್ಟಿ',
    addWatch: 'ವೀಕ್ಷಣಾ ಪಟ್ಟಿಗೆ ಸೇರಿಸಿ',
    removeWatch: 'ವೀಕ್ಷಣಾ ಪಟ್ಟಿಯಿಂದ ತೆಗೆದುಹಾಕಿ',
    exportCsv: 'CSV ಡೌನ್‌ಲೋಡ್',
    syntheticNote: 'ಡೆಮೊ ಸಂಶ್ಲೇಷಿತ ಮಾದರಿ ಸಂಗ್ರಹ ಬಳಸುತ್ತದೆ — ಸಂಶೋಧನೆಗೆ ನಿಜವಾದ NASA ಡೇಟಾ ಬಳಸಿ.',
    uncertaintyNote: 'ಮುನ್ಸೂಚನೆ ಸಂಭಾವ್ಯತೆಯ ಆಧಾರಿತ (p10–p90 ಬ್ಯಾಂಡ್) — ಖಚಿತ ಭವಿಷ್ಯವಲ್ಲ.',
    footerCredit: 'ಡೇಟಾ: NASA Earthdata ಮತ್ತು ಪಾಲುದಾರರು',
    panelTitle: 'ಸ್ಥಳ ವಿವರಣೆ',
    panelHint: 'ಸ್ಥಳವನ್ನು ಪರಿಶೀಲಿಸಲು ನಕ್ಷೆಯಲ್ಲಿ ಕ್ಲಿಕ್ ಮಾಡಿ',
    tabOverview: 'ಸಾರಾಂಶ',
    tabImagery: 'ಚಿತ್ರಗಳು',
    tabOpposite: 'ವಿರುದ್ಧ ಪ್ರವೃತ್ತಿಗಳು',
    tabWhy: 'ಯಾಕೆ?',
    offlineLoad: 'ಆಫ್‌ಲೈನ್ ಮಾದರಿ ಲೋಡ್ ಮಾಡಿ',
    offlineBanner: 'ಆಫ್‌ಲೈನ್ ಮಾದರಿ ಫಿಕ್ಸ್‌ಚರ್ — ಸಂಶ್ಲೇಷಿತ ಡೆಮೊ ಡೇಟಾ, ಕ್ಲಿಕ್ ಮಾಡಿದ ಸ್ಥಳವಲ್ಲ.',
    offlineRetry: 'ಲೈವ್ API ಮರುಪ್ರಯತ್ನಿಸಿ',
    offlineHide: 'ಮಾದರಿ ಮರೆಮಾಡಿ',
    errorTitle: 'ಈ ಸ್ಥಳವನ್ನು ಲೋಡ್ ಮಾಡಲಾಗಲಿಲ್ಲ.',
    showSample: 'ಮಾದರಿ ಪೇಲೋಡ್ ತೋರಿಸಿ',
    retry: 'ಮರುಪ್ರಯತ್ನಿಸಿ',
    loading: 'ಸ್ಥಳ ವಿವರಣೆ ಲೋಡ್ ಆಗುತ್ತಿದೆ…',
    noCoverage: 'ಈ ಸ್ಥಳ/ಅವಧಿಗೆ ಈ ಪ್ಯಾರಾಮೀಟರ್ ಕವರೇಜ್ ಇಲ್ಲ.',
    rawValues: 'ಮೂಲ ಮೌಲ್ಯಗಳು',
    hideRawValues: 'ಮೂಲ ಮೌಲ್ಯಗಳನ್ನು ಮರೆಮಾಡಿ',
  },
}

let locale: Locale = 'en'
try {
  const saved = localStorage.getItem('ep-locale')
  if (saved === 'en' || saved === 'hi' || saved === 'kn') locale = saved
} catch { /* ignore */ }

export function getLocale(): Locale { return locale }
export function setLocale(l: Locale) {
  locale = l
  try { localStorage.setItem('ep-locale', l) } catch { /* ignore */ }
  document.documentElement.lang = l
}

export function t(key: string): string {
  return TABLES[locale][key] ?? TABLES.en[key] ?? key
}

export const LOCALES: Array<{ id: Locale; label: string }> = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'हिन्दी' },
  { id: 'kn', label: 'ಕನ್ನಡ' },
]
