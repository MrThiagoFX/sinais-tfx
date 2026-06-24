// Internacionalização (i18n) — PT, EN, ES
export const translations = {
  pt: {
    idioma: "Idioma",
    language_desc: "Escolha seu idioma preferido. Auto-salvo.",
  },
  en: {
    idioma: "Language",
    language_desc: "Choose your preferred language. Auto-saved.",
  },
  es: {
    idioma: "Idioma",
    language_desc: "Elige tu idioma preferido. Auto-guardado.",
  },
};

export function getSavedLanguage() {
  try {
    return localStorage.getItem("tfx_language") || "pt";
  } catch {
    return "pt";
  }
}

export function saveLanguagePreference(lang) {
  try {
    localStorage.setItem("tfx_language", lang);
  } catch { /* ignore */ }
}
