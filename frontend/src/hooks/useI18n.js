import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';
import { LANGUAGE_OPTIONS } from '../utils/languages';

const DEFAULT_LOCALE = 'pt-BR';
const DEFAULT_CURRENCY_BY_LOCALE = {
  'pt-BR': 'BRL',
  'en-US': 'USD',
  'es-ES': 'EUR',
  'fr-FR': 'EUR'
};

/**
 * Hook personalizado para internacionalização
 * Fornece funcionalidades adicionais além do useTranslation padrão
 */
export const useI18n = () => {
  const { t, i18n } = useTranslation();

  // Função para alterar idioma
  const changeLanguage = useCallback(
    async (languageCode) => {
      try {
        await i18n.changeLanguage(languageCode);
        localStorage.setItem('i18nextLng', languageCode);
        return true;
      } catch (error) {
        console.error('Erro ao alterar idioma:', error);
        return false;
      }
    },
    [i18n]
  );

  // Função para obter idioma atual
  const getCurrentLanguage = useCallback(() => {
    return i18n.language || DEFAULT_LOCALE;
  }, [i18n.language]);

  // Função para verificar se um idioma está disponível
  const isLanguageAvailable = useCallback((languageCode) => {
    return i18n.options.resources && i18n.options.resources[languageCode];
  }, [i18n.options.resources]);

  // Função para obter lista de idiomas disponíveis
  const getAvailableLanguages = useCallback(() => {
    return LANGUAGE_OPTIONS.map((option) => ({
      code: option.locale,
      name: option.label,
      flag: option.flag
    }));
  }, []);

  // Função para traduzir com fallback e suporte a defaultValue + interpolação
  const translate = useCallback((key, arg2, arg3) => {
    try {
      let options = {};

      // Suporta chamadas: t(key, options) OU t(key, defaultValue, options)
      if (typeof arg2 === 'string') {
        options = { ...(typeof arg3 === 'object' && arg3 ? arg3 : {}), defaultValue: arg2 };
      } else if (typeof arg2 === 'object' && arg2) {
        options = arg2;
      }

      const translation = t(key, options);
      // Se a tradução retornar a própria chave, tenta usar defaultValue ou retorna a chave
      if (translation === key) {
        if (options && typeof options.defaultValue === 'string') {
          return t(options.defaultValue, options); // ainda permite interpolação no defaultValue
        }
        console.warn(`Tradução não encontrada para a chave: ${key}`);
        return key;
      }
      return translation;
    } catch (error) {
      console.error(`Erro ao traduzir chave ${key}:`, error);
      return typeof arg2 === 'string' ? arg2 : key;
    }
  }, [t]);

  // Função para formatar números baseado no idioma
  const formatNumber = useCallback((number, options = {}) => {
    const locale = getCurrentLanguage() || DEFAULT_LOCALE;
    return new Intl.NumberFormat(locale, options).format(number);
  }, [getCurrentLanguage]);

  // Função para formatar datas baseado no idioma
  const formatDate = useCallback((date, options = {}) => {
    const locale = getCurrentLanguage() || DEFAULT_LOCALE;
    return new Intl.DateTimeFormat(locale, options).format(new Date(date));
  }, [getCurrentLanguage]);

  // Função para formatar moeda baseado no idioma
  const formatCurrency = useCallback((amount, currency) => {
    const locale = getCurrentLanguage() || DEFAULT_LOCALE;
    const currencyCode =
      currency || DEFAULT_CURRENCY_BY_LOCALE[locale] || DEFAULT_CURRENCY_BY_LOCALE[DEFAULT_LOCALE];

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode
    }).format(amount);
  }, [getCurrentLanguage]);

  return {
    t: translate,
    i18n,
    changeLanguage,
    getCurrentLanguage,
    isLanguageAvailable,
    getAvailableLanguages,
    formatNumber,
    formatDate,
    formatCurrency,
    isReady: i18n.isInitialized
  };
};

export default useI18n;
