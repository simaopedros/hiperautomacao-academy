const BASE_LANGUAGE_ORDER = ['pt', 'es', 'en', 'fr'];

const RAW_LANGUAGE_OPTIONS = [
  {
    code: 'pt',
    locale: 'pt-BR',
    label: 'Português (Brasil)',
    description: 'Cursos em português',
    flag: '🇧🇷',
    aliases: [
      'pt',
      'pt-br',
      'pt_br',
      'portugues',
      'português',
      'portugues-br',
      'portugues (brasil)',
      'br',
      'bra',
      'brazil',
      'brasil'
    ],
    prefixes: ['pt', 'por', 'port', 'braz', 'br']
  },
  {
    code: 'es',
    locale: 'es-ES',
    label: 'Español',
    description: 'Cursos en español',
    flag: '🇪🇸',
    aliases: [
      'es',
      'es-es',
      'es_es',
      'espanol',
      'español',
      'esp',
      'spanish',
      'castellano'
    ],
    prefixes: ['es', 'esp', 'span', 'castel', 'cast']
  },
  {
    code: 'en',
    locale: 'en-US',
    label: 'English (US)',
    description: 'Courses in English',
    flag: '🇺🇸',
    aliases: [
      'en',
      'en-us',
      'en_us',
      'english',
      'ingles',
      'inglês',
      'ing',
      'usa',
      'us'
    ],
    prefixes: ['en', 'eng', 'ing']
  },
  {
    code: 'fr',
    locale: 'fr-FR',
    label: 'Français',
    description: 'Cours en français',
    flag: '🇫🇷',
    aliases: [
      'fr',
      'fr-fr',
      'fr_fr',
      'french',
      'frances',
      'francês',
      'francais',
      'français'
    ],
    prefixes: ['fr', 'fre', 'fra']
  }
];

const CLEAR_TOKENS = new Set(['', 'all', 'any', 'todos', 'todas', 'todo']);

const sanitizeToken = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/[^a-z0-9-]/g, '');
};

const NORMALIZED_OPTIONS = RAW_LANGUAGE_OPTIONS.map((option) => {
  const aliases = new Set(option.aliases.map(sanitizeToken));
  aliases.add(option.code);
  const prefixes = option.prefixes.map(sanitizeToken).filter(Boolean);
  return {
    ...option,
    aliases,
    prefixes: prefixes.length ? prefixes : [option.code]
  };
});

const OPTIONS_BY_CODE = new Map(
  NORMALIZED_OPTIONS.map((option) => [option.code, option])
);

const ORDERED_CODES = [
  ...BASE_LANGUAGE_ORDER.filter((code) => OPTIONS_BY_CODE.has(code)),
  ...NORMALIZED_OPTIONS.map((option) => option.code).filter(
    (code) => !BASE_LANGUAGE_ORDER.includes(code)
  )
];

export const LANGUAGE_OPTIONS = NORMALIZED_OPTIONS.map(
  ({ aliases, prefixes, ...option }) => option
);

export const normalizeLanguageCode = (input) => {
  if (input === null || input === undefined) return null;

  const token = sanitizeToken(input);
  if (!token || CLEAR_TOKENS.has(token)) {
    return null;
  }

  for (const code of ORDERED_CODES) {
    const option = OPTIONS_BY_CODE.get(code);
    if (!option) continue;
    if (option.aliases.has(token)) {
      return option.code;
    }
    if (option.prefixes.some((prefix) => token.startsWith(prefix))) {
      return option.code;
    }
  }

  if (token.includes('-')) {
    return normalizeLanguageCode(token.split('-')[0]);
  }

  return null;
};

export const getLocaleFromCode = (code) => {
  if (!code) return null;
  const option = OPTIONS_BY_CODE.get(code);
  return option ? option.locale : null;
};

export const getLanguageLabel = (code) => {
  if (!code) return null;
  const option = OPTIONS_BY_CODE.get(code);
  return option ? option.label : null;
};

export const getLanguageOption = (code) => {
  if (!code) return null;
  return OPTIONS_BY_CODE.get(code) || null;
};
