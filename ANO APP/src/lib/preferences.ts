export type AppLanguage = 'en' | 'sn' | 'nd';

export interface AppPreferences {
  language: AppLanguage;
  largeText: boolean;
  alertsEnabled: boolean;
  voiceGuidance: boolean;
}

const storageKey = 'ano-app-preferences';

export const defaultPreferences: AppPreferences = {
  language: 'en',
  largeText: false,
  alertsEnabled: false,
  voiceGuidance: false,
};

export function readPreferences() {
  if (typeof window === 'undefined') {
    return defaultPreferences;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return defaultPreferences;
    }

    return {
      ...defaultPreferences,
      ...(JSON.parse(raw) as Partial<AppPreferences>),
    };
  } catch {
    return defaultPreferences;
  }
}

export function savePreferences(preferences: AppPreferences) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(preferences));
}

export function applyPreferencesToDocument(preferences: AppPreferences) {
  if (typeof document === 'undefined') {
    return;
  }

  document.body.classList.toggle('large-text', preferences.largeText);
  document.body.dataset.language = preferences.language;
}

export function getAppCopy(language: AppLanguage) {
  if (language === 'sn') {
    return {
      preferenceLabel: 'Maitiro eapp',
      languageLabel: 'Mutauro',
      textSizeLabel: 'Zvinyorwa zvikuru',
      alertsLabel: 'Zviziviso zvefoni',
      voiceLabel: 'Inzwi rekutungamirira',
      heroEyebrow: 'ANO Crop Advisory',
      heroTitle: 'Hungwaru hwenyika hweminda, varimi, nemabhodhi ekutenga.',
      heroText:
        'Varimi vanowana mirayiridzo inoenderana nenzvimbo, mamiriro ekunze, uye zvirwere zveminda; mabhodhi nevarapi veminda vanowana maonero enyika yose.',
      authTitle: 'Pinda kana gadzira account',
      authIntroStrong: 'Yakagadzirirwa munda, kwete hofisi.',
      authIntroText: 'Mavara anopenya murima, mifananidzo yezvirimwa, uye maquick actions ekuita sarudzo nekukurumidza.',
      todayTitle: 'Nhasi pafamu yako',
      todaySubtitle: 'Mabasa anokurumidza anofanira kutangwa kutanga.',
      agronomistTitle: 'Vanamazvikokota varipo',
    };
  }

  if (language === 'nd') {
    return {
      preferenceLabel: 'Izilungiselelo zohlelo',
      languageLabel: 'Ulimi',
      textSizeLabel: 'Umbhalo omkhulu',
      alertsLabel: 'Izaziso zedivayisi',
      voiceLabel: 'Isiqondiso sezwi',
      heroEyebrow: 'ANO Crop Advisory',
      heroTitle: 'Ulwazi lukazwelonke lwezilimo kubalimi, amabhodi, labeluleki.',
      heroText:
        'Abalimi bathola izeluleko zomhlaba wabo, isimo sezulu, lezifo; amabhodi labanakekeli bezolimo babona umfanekiso wesizwe wonke.',
      authTitle: 'Ngena kumbe sungula i-account',
      authIntroStrong: 'Kwenzelwe insimu, hatshi ihofisi.',
      authIntroText: 'Idashboard emnyama enhle, imifanekiso yezilimo, lama-quick actions okuthatha izinqumo masinyane.',
      todayTitle: 'Namuhla epulazini lakho',
      todaySubtitle: 'Qala ngezinto eziphuthumayo kuqala.',
      agronomistTitle: 'Abeluleki abakhona',
    };
  }

  return {
    preferenceLabel: 'App preferences',
    languageLabel: 'Language',
    textSizeLabel: 'Large text',
    alertsLabel: 'Device alerts',
    voiceLabel: 'Voice guidance',
    heroEyebrow: 'ANO Crop Advisory',
    heroTitle: 'National crop intelligence for growers, boards, agronomists, farm teams, and admins.',
    heroText:
      'Farmers get region-based crop support, weather-aware schedules, season planning, and disease escalation while boards, agronomists, farm teams, and admins see the same field reality.',
    authTitle: 'Sign in or create an account',
    authIntroStrong: 'Designed for the field, not the office.',
    authIntroText:
      'Low-light dashboards, strong contrast, crop imagery, and quick actions built for fast decision-making.',
    todayTitle: 'Today on your farm',
    todaySubtitle: 'Urgent actions rise to the top first.',
    agronomistTitle: 'Available agronomists',
  };
}
