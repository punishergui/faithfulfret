// Daily Fret — Theme Registry (single source of truth for JS)
(function () {
  const themes = [
    {
      id: 'backroom-amp',
      name: 'BACKROOM AMP',
      fontClass: 'font-amp',
      swatches: ['#0d0c0a', '#1d1711', '#f08d3c', '#e8dccf'],
      metaColor: '#f08d3c',
      vars: { '--bg':'#0d0c0a','--bg2':'#171511','--panel':'rgba(29,23,17,0.86)','--panel2':'rgba(240,141,60,0.08)','--text':'#e8dccf','--text2':'#ae9d88','--line':'rgba(255,206,156,0.14)','--line2':'rgba(255,206,156,0.24)','--glow':'rgba(240,141,60,0.3)','--glow2':'rgba(240,141,60,0.16)','--accent':'#f08d3c','--accent2':'#ffc18a','--green':'#39da83','--yellow':'#f7d154','--red':'#ff656c','--hero-bg-image':"url('/img/hero/country.svg')",'--hero-bg-opacity':'0.14','--hero-bg-blend':'overlay','--hero-bg-tint':'rgba(28, 18, 10, 0.48)' }
    },
    {
      id: 'hymn-reverb',
      name: 'HYMN REVERB',
      fontClass: 'font-hymn',
      swatches: ['#15120f', '#272016', '#d8b98c', '#f4ead9'],
      metaColor: '#d8b98c',
      vars: { '--bg':'#15120f','--bg2':'#211a14','--panel':'rgba(39,32,22,0.86)','--panel2':'rgba(216,185,140,0.08)','--text':'#f4ead9','--text2':'#bfae8f','--line':'rgba(216,185,140,0.16)','--line2':'rgba(216,185,140,0.28)','--glow':'rgba(216,185,140,0.26)','--glow2':'rgba(216,185,140,0.14)','--accent':'#d8b98c','--accent2':'#efd2a3','--green':'#4dd886','--yellow':'#f0d96a','--red':'#ff6d73','--hero-bg-image':"url('/img/hero/worship.svg')",'--hero-bg-opacity':'0.16','--hero-bg-blend':'soft-light','--hero-bg-tint':'rgba(30, 22, 16, 0.44)' }
    },
    {
      id: 'spruce-top',
      name: 'SPRUCE TOP',
      fontClass: 'font-acoustic',
      swatches: ['#241d17', '#433327', '#c48d56', '#f1e3cd'],
      metaColor: '#c48d56',
      vars: { '--bg':'#241d17','--bg2':'#33271e','--panel':'rgba(67,51,39,0.86)','--panel2':'rgba(196,141,86,0.09)','--text':'#f1e3cd','--text2':'#c6ac8b','--line':'rgba(231,191,139,0.16)','--line2':'rgba(231,191,139,0.28)','--glow':'rgba(196,141,86,0.27)','--glow2':'rgba(196,141,86,0.15)','--accent':'#c48d56','--accent2':'#ddb27f','--green':'#60d38f','--yellow':'#ebd468','--red':'#ff6f6f','--hero-bg-image':"url('/img/hero/country.svg')",'--hero-bg-opacity':'0.15','--hero-bg-blend':'multiply','--hero-bg-tint':'rgba(43, 28, 18, 0.5)' }
    },
    {
      id: 'signal-loss',
      name: 'SIGNAL LOSS',
      fontClass: 'font-ambient',
      swatches: ['#080b10', '#121824', '#7ab7ff', '#d8e7ff'],
      metaColor: '#7ab7ff',
      vars: { '--bg':'#080b10','--bg2':'#101626','--panel':'rgba(18,24,36,0.86)','--panel2':'rgba(122,183,255,0.08)','--text':'#d8e7ff','--text2':'#98abc6','--line':'rgba(152,184,226,0.16)','--line2':'rgba(152,184,226,0.28)','--glow':'rgba(122,183,255,0.28)','--glow2':'rgba(122,183,255,0.15)','--accent':'#7ab7ff','--accent2':'#a5cbff','--green':'#59da9a','--yellow':'#f2d668','--red':'#ff6f82','--hero-bg-image':"url('/img/hero/djent.svg')",'--hero-bg-opacity':'0.13','--hero-bg-blend':'soft-light','--hero-bg-tint':'rgba(9, 14, 26, 0.5)' }
    },
    {
      id: 'cryo-chorus',
      name: 'CRYO CHORUS',
      fontClass: 'font-digital',
      swatches: ['#071017', '#132a36', '#3dd6ff', '#e4f8ff'],
      metaColor: '#3dd6ff',
      vars: { '--bg':'#071017','--bg2':'#0f1f2e','--panel':'rgba(19,42,54,0.86)','--panel2':'rgba(61,214,255,0.08)','--text':'#e4f8ff','--text2':'#98b9c7','--line':'rgba(161,225,241,0.15)','--line2':'rgba(161,225,241,0.28)','--glow':'rgba(61,214,255,0.28)','--glow2':'rgba(61,214,255,0.15)','--accent':'#3dd6ff','--accent2':'#86ebff','--green':'#4ce3ae','--yellow':'#f0dd74','--red':'#ff7272','--hero-bg-image':"url('/img/hero/djent.svg')",'--hero-bg-opacity':'0.12','--hero-bg-blend':'overlay','--hero-bg-tint':'rgba(5, 18, 26, 0.5)' }
    },
    {
      id: 'radioactive-gain',
      name: 'RADIOACTIVE GAIN',
      fontClass: 'font-metal',
      swatches: ['#070b08', '#151f13', '#86ff1e', '#e9f6dd'],
      metaColor: '#86ff1e',
      vars: { '--bg':'#070b08','--bg2':'#10170f','--panel':'rgba(21,31,19,0.88)','--panel2':'rgba(134,255,30,0.08)','--text':'#e9f6dd','--text2':'#9db38f','--line':'rgba(166,199,154,0.16)','--line2':'rgba(166,199,154,0.3)','--glow':'rgba(134,255,30,0.29)','--glow2':'rgba(134,255,30,0.15)','--accent':'#86ff1e','--accent2':'#b8ff70','--green':'#90ff39','--yellow':'#d9f252','--red':'#ff5f6d','--hero-bg-image':"url('/img/hero/nu-metal.svg')",'--hero-bg-opacity':'0.17','--hero-bg-blend':'multiply','--hero-bg-tint':'rgba(9, 14, 8, 0.52)' }
    },
    {
      id: 'tube-glow',
      name: 'TUBE GLOW',
      fontClass: 'font-tube',
      swatches: ['#120909', '#311d1c', '#ff7b57', '#ffe9e1'],
      metaColor: '#ff7b57',
      vars: { '--bg':'#120909','--bg2':'#211211','--panel':'rgba(49,29,28,0.86)','--panel2':'rgba(255,123,87,0.08)','--text':'#ffe9e1','--text2':'#c5a29a','--line':'rgba(228,175,167,0.16)','--line2':'rgba(228,175,167,0.28)','--glow':'rgba(255,123,87,0.29)','--glow2':'rgba(255,123,87,0.16)','--accent':'#ff7b57','--accent2':'#ffac97','--green':'#69d887','--yellow':'#f5cb5f','--red':'#ff4d4d','--hero-bg-image':"url('/img/hero/worship.svg')",'--hero-bg-opacity':'0.14','--hero-bg-blend':'soft-light','--hero-bg-tint':'rgba(28, 13, 11, 0.5)' }
    },
    {
      id: 'blue-hour',
      name: 'BLUE HOUR',
      fontClass: 'font-cinematic',
      swatches: ['#090d1d', '#192847', '#6f8fff', '#e6edff'],
      metaColor: '#6f8fff',
      vars: { '--bg':'#090d1d','--bg2':'#121d35','--panel':'rgba(25,40,71,0.86)','--panel2':'rgba(111,143,255,0.08)','--text':'#e6edff','--text2':'#a2afd4','--line':'rgba(157,173,233,0.16)','--line2':'rgba(157,173,233,0.28)','--glow':'rgba(111,143,255,0.28)','--glow2':'rgba(111,143,255,0.15)','--accent':'#6f8fff','--accent2':'#9db3ff','--green':'#5de3a1','--yellow':'#f2d565','--red':'#ff6d7d','--hero-bg-image':"url('/img/hero/djent.svg')",'--hero-bg-opacity':'0.12','--hero-bg-blend':'overlay','--hero-bg-tint':'rgba(10, 15, 31, 0.5)' }
    },
    {
      id: 'studio-flat',
      name: 'STUDIO FLAT',
      fontClass: 'font-studio',
      swatches: ['#101112', '#2a3038', '#cfd7e3', '#f2f5fa'],
      metaColor: '#cfd7e3',
      vars: { '--bg':'#101112','--bg2':'#1b1f25','--panel':'rgba(42,48,56,0.86)','--panel2':'rgba(207,215,227,0.06)','--text':'#f2f5fa','--text2':'#b4bbc7','--line':'rgba(196,203,214,0.15)','--line2':'rgba(196,203,214,0.26)','--glow':'rgba(207,215,227,0.22)','--glow2':'rgba(207,215,227,0.12)','--accent':'#cfd7e3','--accent2':'#edf2f9','--green':'#64d28e','--yellow':'#e8d06c','--red':'#ff6f79','--hero-bg-image':"url('/img/hero/nu-metal.svg')",'--hero-bg-opacity':'0.11','--hero-bg-blend':'soft-light','--hero-bg-tint':'rgba(20, 22, 26, 0.48)' }
    },
    {
      id: 'tape-saturation',
      name: 'TAPE SATURATION',
      fontClass: 'font-tape',
      swatches: ['#110a10', '#2d1830', '#d686ff', '#f6e6ff'],
      metaColor: '#d686ff',
      vars: { '--bg':'#110a10','--bg2':'#1b1024','--panel':'rgba(45,24,48,0.87)','--panel2':'rgba(214,134,255,0.08)','--text':'#f6e6ff','--text2':'#b6a1c7','--line':'rgba(203,172,224,0.16)','--line2':'rgba(203,172,224,0.28)','--glow':'rgba(214,134,255,0.3)','--glow2':'rgba(214,134,255,0.16)','--accent':'#d686ff','--accent2':'#e9b5ff','--green':'#6ce29e','--yellow':'#ecd268','--red':'#ff6a86','--hero-bg-image':"url('/img/hero/nu-metal.svg')",'--hero-bg-opacity':'0.14','--hero-bg-blend':'overlay','--hero-bg-tint':'rgba(24, 13, 31, 0.52)' }
    }
  ];

  window.FF_THEMES = themes;
  window.FF_THEME_DEFAULT = 'backroom-amp';

  const themeMap = Object.fromEntries(themes.map((theme) => [theme.id, theme]));
  const fallbackTheme = window.FF_THEME_DEFAULT;

  function resolveTheme(themeId) {
    return themeMap[themeId] ? themeId : fallbackTheme;
  }

  function applyThemeToRootAndBody(themeId) {
    const value = resolveTheme(themeId || localStorage.getItem('theme') || fallbackTheme);
    document.documentElement.dataset.theme = value;
    if (document.body) document.body.dataset.theme = value;
    return value;
  }

  applyThemeToRootAndBody();
  document.addEventListener('DOMContentLoaded', () => applyThemeToRootAndBody(), { once: true });

  const observer = new MutationObserver(() => {
    applyThemeToRootAndBody(document.documentElement.dataset.theme);
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();
