import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useI18n } from './useI18n';
import {
  LANGUAGE_OPTIONS,
  normalizeLanguageCode,
  getLocaleFromCode
} from '../utils/languages';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const useLanguagePreferences = (user, updateUser) => {
  const { changeLanguage, getCurrentLanguage, isReady } = useI18n();
  const [contentLanguage, setContentLanguage] = useState(
    () => normalizeLanguageCode(user?.preferred_language) || null
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const normalized = normalizeLanguageCode(user?.preferred_language);
    if (normalized !== contentLanguage) {
      setContentLanguage(normalized);
    }

    if (!isReady) return;

    const preferredLocale =
      user?.preferred_locale || getLocaleFromCode(normalized);
    if (!preferredLocale) return;

    const currentLocale = getCurrentLanguage();
    if (currentLocale !== preferredLocale) {
      changeLanguage(preferredLocale);
    }
  }, [
    user?.preferred_language,
    user?.preferred_locale,
    isReady,
    contentLanguage,
    getCurrentLanguage,
    changeLanguage
  ]);

  const applyInterfaceLocale = useCallback(
    async (languageCode) => {
      const locale = getLocaleFromCode(languageCode);
      if (!locale) return;
      await changeLanguage(locale);
    },
    [changeLanguage]
  );

  const selectLanguage = useCallback(
    async (languageCode) => {
      const normalized = normalizeLanguageCode(languageCode);
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        await axios.put(
          `${API}/auth/language`,
          { language: normalized },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        setContentLanguage(normalized);
        if (normalized) {
          await applyInterfaceLocale(normalized);
        }

        if (updateUser) {
          updateUser({
            preferred_language: normalized,
            preferred_locale: getLocaleFromCode(normalized)
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [applyInterfaceLocale, updateUser]
  );

  return {
    contentLanguage,
    loading,
    selectLanguage,
    languageOptions: LANGUAGE_OPTIONS
  };
};
