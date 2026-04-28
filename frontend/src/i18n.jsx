/* eslint-disable react-refresh/only-export-components */
// Lightweight in-house i18n. No external deps; suits our two-language scope.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const LS_KEY = 'baladiya.lang.v1';

export const STRINGS = {
  en: {
    appName: 'Baladiya',
    welcome: 'Assalamu Alaikum,',
    welcomeSub: 'Your contribution helps us build a cleaner, safer, and smarter municipality for everyone.',
    citizen: 'Citizen',

    // Nav
    home: 'Home',
    report: 'Report',
    tickets: 'Tickets',
    profile: 'Profile',
    admin: 'Admin',

    // Dashboard
    quickCategories: 'Quick categories',
    seeAll: 'See all',
    reportNewIssue: 'Report New Issue',
    tapShutter: 'Tap the lens to capture and submit',
    shutter: 'SHUTTER',

    // My tickets
    myTickets: 'My Tickets',
    myTicketsSub: 'Track your active and historical municipal service requests.',
    allTickets: 'All Tickets',
    inProgress: 'In Progress',
    resolved: 'Resolved',
    investigating: 'Investigating',
    rejected: 'Rejected',
    viewDetails: 'View Details',
    noTicketsYet: 'No tickets yet',
    noTicketsSub: 'Tap "Report New Issue" to file your first report.',

    // Capture
    smartReport: 'Smart Report',
    step1of2: 'Step 1 of 2',
    captureTheIssue: 'Capture the Issue',
    captureSubtitle: 'Take a clear photo. Our AI will categorize it and ask one quick clarifying question.',
    locating: 'Locating…',
    retryLocation: 'Retry location',
    locationRequired: 'Location is required. Allow location access and retry.',
    pickPhotoFirst: 'Please capture or upload a photo.',
    upload: 'Upload',
    analyzeIssue: 'Analyze Issue',
    analyzing: 'Analyzing image…',
    identifying: 'Identifying object…',
    drafting: 'Drafting report…',
    aiAnalysisInProgress: 'AI Analysis in Progress',

    // Duplicate
    possibleDuplicate: 'Possible duplicate',
    possibleDuplicateBody: (n) => `We found ${n} open ticket${n === 1 ? '' : 's'} for this category within ~50 m of your location. Is this the same issue?`,
    sameIssueCancel: 'Yes, same issue (cancel)',
    continueReport: 'No, continue with my report',

    // Confirmation
    reportSubmitted: 'Report Submitted',
    reportSubmittedSub: 'Your ticket has been routed to the responsible department.',
    routedTo: 'Routed to',
    status: 'Status',
    severity: 'Severity',
    locationGps: 'Location',
    submittedAt: 'Submitted',
    description: 'Description',
    yourPhoto: 'Your photo',
    backToDashboard: 'Back to Dashboard',
    fileAnother: 'File another report',
    expectedResolution: 'Expected resolution',
    progress: 'Progress',

    // Profile
    settings: 'Settings',
    language: 'Language',
    english: 'English',
    arabic: 'العربية',
    signOut: 'Sign out',
    signOutConfirm: 'Sign out of Baladiya?',
    role: 'Role',
    department: 'Department',
    none: 'None',

    // Sign-in / sign-up screen kept short
    signIn: 'Sign In',
    signUp: 'Sign Up',

    // Weather
    weatherLoading: 'Loading weather…',
    weatherError: 'Weather unavailable',
    clearSky: 'Clear sky',
    mainlyClear: 'Mainly clear',
    partlyCloudy: 'Partly cloudy',
    overcast: 'Overcast',
    foggy: 'Foggy',
    drizzle: 'Drizzle',
    rain: 'Rain',
    showers: 'Showers',
    snow: 'Snow',
    thunderstorm: 'Thunderstorm',
  },
  ar: {
    appName: 'بلدية',
    welcome: 'السلام عليكم،',
    welcomeSub: 'مساهمتكم تساعدنا في بناء بلدية أنظف وأكثر أمانًا للجميع.',
    citizen: 'مواطن',

    home: 'الرئيسية',
    report: 'بلاغ',
    tickets: 'البلاغات',
    profile: 'حسابي',
    admin: 'الإدارة',

    quickCategories: 'الفئات السريعة',
    seeAll: 'عرض الكل',
    reportNewIssue: 'إرسال بلاغ جديد',
    tapShutter: 'اضغط الزر لالتقاط وإرسال البلاغ',
    shutter: 'تصوير',

    myTickets: 'بلاغاتي',
    myTicketsSub: 'تابع بلاغاتك الحالية والسابقة لخدمات البلدية.',
    allTickets: 'كل البلاغات',
    inProgress: 'قيد المعالجة',
    resolved: 'تم الحل',
    investigating: 'قيد المراجعة',
    rejected: 'مرفوض',
    viewDetails: 'عرض التفاصيل',
    noTicketsYet: 'لا توجد بلاغات بعد',
    noTicketsSub: 'اضغط "إرسال بلاغ جديد" لإرسال أول بلاغ.',

    smartReport: 'البلاغ الذكي',
    step1of2: 'الخطوة 1 من 2',
    captureTheIssue: 'التقط المشكلة',
    captureSubtitle: 'التقط صورة واضحة. سيقوم الذكاء الاصطناعي بتصنيفها وطرح سؤال توضيحي.',
    locating: 'جارٍ تحديد الموقع…',
    retryLocation: 'إعادة المحاولة',
    locationRequired: 'الموقع مطلوب. يرجى السماح بالوصول وإعادة المحاولة.',
    pickPhotoFirst: 'يرجى التقاط صورة أولًا.',
    upload: 'رفع',
    analyzeIssue: 'تحليل المشكلة',
    analyzing: 'تحليل الصورة…',
    identifying: 'التعرّف على الهدف…',
    drafting: 'إعداد البلاغ…',
    aiAnalysisInProgress: 'جارٍ تحليل الذكاء الاصطناعي',

    possibleDuplicate: 'بلاغ مشابه قائم',
    possibleDuplicateBody: (n) => `وجدنا ${n} بلاغ${n === 1 ? '' : 'ات'} مفتوحة في نفس المنطقة (~50 م). هل هذه نفس المشكلة؟`,
    sameIssueCancel: 'نعم، نفس المشكلة (إلغاء)',
    continueReport: 'لا، استمرار بإرسال بلاغ جديد',

    reportSubmitted: 'تم إرسال البلاغ',
    reportSubmittedSub: 'تم توجيه البلاغ إلى الإدارة المختصة.',
    routedTo: 'موجَّه إلى',
    status: 'الحالة',
    severity: 'الأولوية',
    locationGps: 'الموقع',
    submittedAt: 'تاريخ الإرسال',
    description: 'الوصف',
    yourPhoto: 'الصورة',
    backToDashboard: 'العودة للرئيسية',
    fileAnother: 'إرسال بلاغ آخر',
    expectedResolution: 'الموعد المتوقَّع للحل',
    progress: 'تقدُّم البلاغ',

    settings: 'الإعدادات',
    language: 'اللغة',
    english: 'English',
    arabic: 'العربية',
    signOut: 'تسجيل الخروج',
    signOutConfirm: 'هل تريد تسجيل الخروج؟',
    role: 'الدور',
    department: 'القسم',
    none: 'لا يوجد',

    signIn: 'تسجيل الدخول',
    signUp: 'إنشاء حساب',

    weatherLoading: 'جارٍ تحميل الطقس…',
    weatherError: 'الطقس غير متاح',
    clearSky: 'صحو',
    mainlyClear: 'صحو غالبًا',
    partlyCloudy: 'غائم جزئيًا',
    overcast: 'غائم',
    foggy: 'ضباب',
    drizzle: 'رذاذ',
    rain: 'مطر',
    showers: 'زخات مطر',
    snow: 'ثلج',
    thunderstorm: 'عواصف رعدية',
  },
};

export const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try { return localStorage.getItem(LS_KEY) || 'en'; }
    catch { return 'en'; }
  });
  const setLang = useCallback((next) => {
    if (next !== 'en' && next !== 'ar') return;
    setLangState(next);
    try { localStorage.setItem(LS_KEY, next); } catch { /* noop */ }
  }, []);

  // Reflect direction on <html> for global RTL support.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('lang', lang);
    root.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  }, [lang]);

  const value = useMemo(() => {
    const dict = STRINGS[lang] || STRINGS.en;
    const t = (key, ...args) => {
      const v = dict[key];
      if (typeof v === 'function') return v(...args);
      return v ?? STRINGS.en[key] ?? key;
    };
    return { lang, setLang, t, dir: lang === 'ar' ? 'rtl' : 'ltr' };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be inside <I18nProvider>');
  return ctx;
}
