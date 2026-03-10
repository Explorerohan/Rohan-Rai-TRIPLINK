import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import en from "../i18n/en.json";
import ne from "../i18n/ne.json";

const STORAGE_KEY = "@triplink_language";

const translations = { en, ne };

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState("en");
  const [isLanguageReady, setIsLanguageReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (stored === "en" || stored === "ne") {
          setLanguageState(stored);
        }
      } catch (e) {
        if (!cancelled) console.warn("Load language failed:", e);
      } finally {
        if (!cancelled) setIsLanguageReady(true);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const setLanguage = useCallback((lang) => {
    if (lang !== "en" && lang !== "ne") return;
    setLanguageState(lang);
    AsyncStorage.setItem(STORAGE_KEY, lang).catch(() => {});
  }, []);

  const t = useCallback(
    (key) => {
      const dict = translations[language] || translations.en;
      const fallback = translations.en[key];
      return dict[key] ?? fallback ?? key;
    },
    [language]
  );

  const isNepali = language === "ne";

  const value = {
    language,
    setLanguage,
    t,
    isNepali,
    isLanguageReady,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
