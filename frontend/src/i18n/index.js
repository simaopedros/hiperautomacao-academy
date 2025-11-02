import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

// Importar traduções locais como fallback
import ptBR from './locales/pt-BR.json';
import enUS from './locales/en-US.json';
import esES from './locales/es-ES.json';

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
    fallbackLng: 'pt-BR',
    supportedLngs: ['pt-BR', 'en-US', 'es-ES'],
    debug: process.env.NODE_ENV === 'development',

    // Opções de detecção de idioma
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
      checkWhitelist: true,
    },

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
    load: 'all', // Carregar todos os códigos de idioma (pt-BR, en-US, etc.)
    preload: ['pt-BR', 'en-US', 'es-ES'],

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

export default i18n;