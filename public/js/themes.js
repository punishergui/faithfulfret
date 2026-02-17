// Daily Fret — Theme Registry (single source of truth for JS)
(function () {
  const themes = [
    {
      id: 'shed',
      name: 'Shed',
      vars: { '--bg':'#0d0c0a','--bg2':'#171511','--panel':'rgba(28,24,18,0.82)','--panel2':'rgba(255,168,94,0.08)','--text':'#e8dccf','--text2':'#ae9d88','--line':'rgba(255,206,156,0.14)','--line2':'rgba(255,206,156,0.24)','--glow':'rgba(255,149,64,0.28)','--glow2':'rgba(255,149,64,0.16)','--accent':'#ff9540','--accent2':'#ffc18a','--green':'#33d17a','--yellow':'#f7d154','--red':'#ff5f61' }
    },
    {
      id: 'faithful',
      name: 'Faithful',
      vars: { '--bg':'#14100d','--bg2':'#1e1813','--panel':'rgba(39,30,22,0.82)','--panel2':'rgba(227,198,142,0.08)','--text':'#efe3cf','--text2':'#bfaf92','--line':'rgba(217,187,136,0.16)','--line2':'rgba(217,187,136,0.28)','--glow':'rgba(217,187,136,0.25)','--glow2':'rgba(217,187,136,0.14)','--accent':'#d9bb88','--accent2':'#efd2a3','--green':'#4bd17f','--yellow':'#f5d86b','--red':'#ff6970' }
    },
    {
      id: 'stage',
      name: 'Stage',
      vars: { '--bg':'#070b10','--bg2':'#101825','--panel':'rgba(15,26,39,0.82)','--panel2':'rgba(98,255,206,0.07)','--text':'#ddf8ef','--text2':'#9cc0b5','--line':'rgba(131,255,215,0.16)','--line2':'rgba(131,255,215,0.28)','--glow':'rgba(0,255,170,0.25)','--glow2':'rgba(0,255,170,0.14)','--accent':'#00ffaa','--accent2':'#6fffd2','--green':'#55ff7d','--yellow':'#ffd85f','--red':'#ff5d67' }
    },
    {
      id: 'acoustic',
      name: 'Acoustic',
      vars: { '--bg':'#26201a','--bg2':'#382d23','--panel':'rgba(71,56,42,0.82)','--panel2':'rgba(235,190,136,0.08)','--text':'#f1e3cd','--text2':'#c6ac8b','--line':'rgba(231,191,139,0.16)','--line2':'rgba(231,191,139,0.28)','--glow':'rgba(198,146,90,0.26)','--glow2':'rgba(198,146,90,0.15)','--accent':'#c6925a','--accent2':'#e1b27d','--green':'#59cb88','--yellow':'#ebd468','--red':'#ff6d6d' }
    },
    {
      id: 'toxic',
      name: 'Toxic',
      vars: { '--bg':'#070b08','--bg2':'#111712','--panel':'rgba(15,22,16,0.86)','--panel2':'rgba(133,255,0,0.08)','--text':'#e9f6dd','--text2':'#96ae8d','--line':'rgba(166,199,154,0.15)','--line2':'rgba(166,199,154,0.28)','--glow':'rgba(125,255,31,0.28)','--glow2':'rgba(125,255,31,0.15)','--accent':'#7dff1f','--accent2':'#b4ff6d','--green':'#89ff2f','--yellow':'#d9f252','--red':'#ff5d6a' }
    },
    {
      id: 'void',
      name: 'Void',
      vars: { '--bg':'#0a0712','--bg2':'#171022','--panel':'rgba(22,16,34,0.86)','--panel2':'rgba(182,108,255,0.08)','--text':'#efe6ff','--text2':'#a79ac2','--line':'rgba(189,173,218,0.15)','--line2':'rgba(189,173,218,0.28)','--glow':'rgba(168,85,247,0.3)','--glow2':'rgba(168,85,247,0.16)','--accent':'#a855f7','--accent2':'#cc8dff','--green':'#69f09d','--yellow':'#eecf6c','--red':'#ff6c7f' }
    },
    {
      id: 'ice',
      name: 'Ice',
      vars: { '--bg':'#071017','--bg2':'#10212c','--panel':'rgba(14,30,40,0.84)','--panel2':'rgba(118,230,255,0.08)','--text':'#e6f8ff','--text2':'#98b9c7','--line':'rgba(161,225,241,0.15)','--line2':'rgba(161,225,241,0.28)','--glow':'rgba(64,224,255,0.27)','--glow2':'rgba(64,224,255,0.15)','--accent':'#40e0ff','--accent2':'#88efff','--green':'#46eaa9','--yellow':'#f0dd74','--red':'#ff6a6a' }
    },
    {
      id: 'ember',
      name: 'Ember',
      vars: { '--bg':'#120909','--bg2':'#221211','--panel':'rgba(38,21,20,0.85)','--panel2':'rgba(255,109,90,0.08)','--text':'#ffe8e0','--text2':'#c5a29a','--line':'rgba(228,175,167,0.16)','--line2':'rgba(228,175,167,0.28)','--glow':'rgba(255,99,71,0.29)','--glow2':'rgba(255,99,71,0.16)','--accent':'#ff6347','--accent2':'#ff9b86','--green':'#69d887','--yellow':'#f5cb5f','--red':'#ff4d4d' }
    },
    {
      id: 'midnight',
      name: 'Midnight',
      vars: { '--bg':'#090d1d','--bg2':'#111833','--panel':'rgba(17,25,49,0.84)','--panel2':'rgba(93,122,255,0.08)','--text':'#e6ebff','--text2':'#9ca9cf','--line':'rgba(157,173,233,0.16)','--line2':'rgba(157,173,233,0.28)','--glow':'rgba(93,122,255,0.27)','--glow2':'rgba(93,122,255,0.15)','--accent':'#5d7aff','--accent2':'#93a7ff','--green':'#57e39c','--yellow':'#f2d565','--red':'#ff6b79' }
    },
    {
      id: 'mono',
      name: 'Mono',
      vars: { '--bg':'#101112','--bg2':'#1c1f23','--panel':'rgba(30,34,40,0.84)','--panel2':'rgba(235,235,235,0.05)','--text':'#f1f3f6','--text2':'#b4bbc7','--line':'rgba(196,203,214,0.14)','--line2':'rgba(196,203,214,0.24)','--glow':'rgba(224,230,240,0.2)','--glow2':'rgba(224,230,240,0.12)','--accent':'#d2dae8','--accent2':'#eef2f8','--green':'#64d28e','--yellow':'#e8d06c','--red':'#ff6f79' }
    }
  ];

  window.FF_THEMES = themes;
  window.FF_THEME_DEFAULT = 'shed';
})();
