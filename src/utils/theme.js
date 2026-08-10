export const THEME_STORAGE_KEY = 'pedidoFlowTheme';

export const THEMES = [
  {
    key: 'atlas',
    name: 'Cop\u00e3o Gold',
    description: 'Preto agressivo com amarelo eletrizante da marca.',
    preview: {
      accent: '#ffd400',
      bg: '#050505',
      surface: '#151515',
      border: '#6e5812',
    },
  },
  {
    key: 'safira',
    name: 'Neon Storm',
    description: 'Azul neon de alto impacto.',
    preview: {
      accent: '#50abff',
      bg: '#08101a',
      surface: '#152338',
      border: '#355887',
    },
  },
  {
    key: 'graphite',
    name: 'Steel Mint',
    description: 'A\u00e7o escuro com brilho verde frio.',
    preview: {
      accent: '#00d4bb',
      bg: '#0a0f10',
      surface: '#172325',
      border: '#2e4a4c',
    },
  },
  {
    key: 'sage',
    name: 'Toxic Field',
    description: 'Verde t\u00f3xico para presen\u00e7a marcante.',
    preview: {
      accent: '#abdc4f',
      bg: '#0a120c',
      surface: '#172419',
      border: '#365540',
    },
  },
  {
    key: 'copper',
    name: 'Copper Heat',
    description: 'Bronze quente com contraste brutal.',
    preview: {
      accent: '#ff9b5d',
      bg: '#120d0a',
      surface: '#261c17',
      border: '#53372a',
    },
  },
];

export const getStoredTheme = () => {
  if (typeof window === 'undefined') return 'atlas';
  return window.localStorage.getItem(THEME_STORAGE_KEY) || 'atlas';
};

export const applyTheme = (themeKey) => {
  if (typeof window === 'undefined') return;
  const next = THEMES.find((theme) => theme.key === themeKey)?.key || 'atlas';
  document.documentElement.setAttribute('data-theme', next);
  window.localStorage.setItem(THEME_STORAGE_KEY, next);
};
