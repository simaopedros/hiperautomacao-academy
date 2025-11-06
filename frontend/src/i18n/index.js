import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

// Importar traduções locais como fallback
import ptBR from './locales/pt-BR.json';
import enUS from './locales/en-US.json';
import esES from './locales/es-ES.json';

const supportedLanguages = ['pt-BR', 'en-US', 'es-ES'];
const fallbackLanguage = 'pt-BR';

const normalizeLanguage = (lng) => {
  if (!lng) {
    return fallbackLanguage;
  }

  const lower = lng.toLowerCase();

  if (lower === 'pt' || lower.startsWith('pt-')) {
    return 'pt-BR';
  }

  if (lower === 'en' || lower.startsWith('en-')) {
    return 'en-US';
  }

  if (lower === 'es' || lower.startsWith('es-')) {
    return 'es-ES';
  }

  const exact = supportedLanguages.find((lang) => lang.toLowerCase() === lower);
  return exact || fallbackLanguage;
};

const resources = {
  'pt-BR': {
    translation: ptBR
  },
  'en-US': {
    translation: enUS
  },
  'es-ES': {
    translation: esES
  }
};

const detectionOptions = {
  order: ['localStorage', 'navigator', 'htmlTag'],
  caches: ['localStorage'],
  lookupLocalStorage: 'i18nextLng',
  checkWhitelist: true,
  convertDetectedLanguage: normalizeLanguage,
};

if (!i18n.__changeLanguagePatched) {
  const originalChangeLanguage = i18n.changeLanguage.bind(i18n);
  i18n.changeLanguage = (lng, ...rest) =>
    originalChangeLanguage(normalizeLanguage(lng), ...rest);
  i18n.__changeLanguagePatched = true;
}

if (!i18n.isInitialized) {
  i18n
    // Carregar traduções usando http -> veja /public/locales (apenas se usar backend)
    .use(Backend)
    // Detectar idioma do usuário
    .use(LanguageDetector)
    // Passar a instância i18n para react-i18next
    .use(initReactI18next)
    // Inicializar i18next
    .init({
      resources,
      fallbackLng: fallbackLanguage,
      supportedLngs: supportedLanguages,
      debug: process.env.NODE_ENV === 'development',

      // Opções de detecção de idioma
      detection: detectionOptions,

      interpolation: {
        escapeValue: false, // não necessário para react pois já escapa por padrão
      },

      // Configuração do backend (opcional, para carregar traduções remotamente)
      backend: {
        loadPath: '/locales/{{lng}}.json',
      },

      // Namespace padrão
      defaultNS: 'translation',
      ns: ['translation'],

      // Configurações de carregamento
      load: 'currentOnly',
      preload: supportedLanguages,

      // Configurações de pluralização
      pluralSeparator: '_',
      contextSeparator: '_',

      // Configurações de chaves
      keySeparator: '.',
      nsSeparator: ':',

      // Configurações de retorno
      returnNull: false,
      returnEmptyString: false,
      returnObjects: false,

      // Configurações de join
      joinArrays: false,

      // Configurações de post-processamento
      postProcess: false,

      // Configurações de react
      react: {
        useSuspense: false,
        bindI18n: 'languageChanged',
        bindI18nStore: '',
        transEmptyNodeValue: '',
        transSupportBasicHtmlNodes: true,
        transKeepBasicHtmlNodesFor: ['br', 'strong', 'i'],
      }
    });

  const activeLanguage = normalizeLanguage(i18n.language);
  if (activeLanguage !== i18n.language) {
    i18n.changeLanguage(activeLanguage);
  }
}

i18n.on('languageChanged', (lng) => {
  const normalized = normalizeLanguage(lng);
  if (normalized !== lng) {
    i18n.changeLanguage(normalized);
    return;
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem('i18nextLng', normalized);
  }
});

export default i18n;
