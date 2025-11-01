import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';

/**
 * Hook personalizado para internacionalização
 * Fornece funcionalidades adicionais além do useTranslation padrão
 */
export const useI18n = () => {
  const { t, i18n } = useTranslation();

  // Função para alterar idioma
  const changeLanguage = useCallback(async (languageCode) => {
    try {
      await i18n.changeLanguage(languageCode);
      localStorage.setItem('i18nextLng', languageCode);
      
      // Atualizar preferência do usuário no backend se estiver logado
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user && user.id) {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/users/language`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ preferred_language: languageCode })
          });

          if (response.ok) {
            const updatedUser = { ...user, preferred_language: languageCode };
            localStorage.setItem('user', JSON.stringify(updatedUser));
          }
        } catch (error) {
          console.warn('Erro ao salvar preferência de idioma no servidor:', error);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao alterar idioma:', error);
      return false;
    }
  }, [i18n]);

  // Função para obter idioma atual
  const getCurrentLanguage = useCallback(() => {
    return i18n.language || 'pt-BR';
  }, [i18n.language]);

  // Função para verificar se um idioma está disponível
  const isLanguageAvailable = useCallback((languageCode) => {
    return i18n.options.resources && i18n.options.resources[languageCode];
  }, [i18n.options.resources]);

  // Função para obter lista de idiomas disponíveis
  const getAvailableLanguages = useCallback(() => {
    return [
      { code: 'pt-BR', name: 'Português (Brasil)', flag: '🇧🇷' },
      { code: 'en-US', name: 'English (United States)', flag: '🇺🇸' }
    ];
  }, []);

  // Função para traduzir com fallback
  const translate = useCallback((key, options = {}) => {
    try {
      const translation = t(key, options);
      // Se a tradução retornar a própria chave, significa que não foi encontrada
      if (translation === key) {
        console.warn(`Tradução não encontrada para a chave: ${key}`);
        return key;
      }
      return translation;
    } catch (error) {
      console.error(`Erro ao traduzir chave ${key}:`, error);
      return key;
    }
  }, [t]);

  // Função para formatar números baseado no idioma
  const formatNumber = useCallback((number, options = {}) => {
    const locale = getCurrentLanguage() === 'pt-BR' ? 'pt-BR' : 'en-US';
    return new Intl.NumberFormat(locale, options).format(number);
  }, [getCurrentLanguage]);

  // Função para formatar datas baseado no idioma
  const formatDate = useCallback((date, options = {}) => {
    const locale = getCurrentLanguage() === 'pt-BR' ? 'pt-BR' : 'en-US';
    return new Intl.DateTimeFormat(locale, options).format(new Date(date));
  }, [getCurrentLanguage]);

  // Função para formatar moeda baseado no idioma
  const formatCurrency = useCallback((amount, currency = 'BRL') => {
    const locale = getCurrentLanguage() === 'pt-BR' ? 'pt-BR' : 'en-US';
    const currencyCode = getCurrentLanguage() === 'pt-BR' ? 'BRL' : 'USD';
    
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency || currencyCode
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