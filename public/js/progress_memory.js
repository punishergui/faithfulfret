window.progressMem = (() => {
  const STORAGE_KEY = 'df_progress_mem';
  const MAX_DAYS = 90;
  const MAX_MAP_KEYS = 20;

  const defaultState = () => ({
    version: 1,
    active: {
      startedAt: null,
      tool: null,
      key: null,
      progressionId: null,
    },
    streak: {
      current: 0,
      best: 0,
      lastDay: null,
      days: [],
    },
    minutes: {
      total: 0,
      week: {
        weekStart: null,
        minutes: 0,
      },
    },
    byKeyWeek: {},
    byProgWeek: {},
  });

  const toInt = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
  };

  const todayString = () => {
    const now = new Date();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${m}-${d}`;
  };

  const shiftDay = (dayStr, dayDelta) => {
    if (!dayStr) return null;
    const date = new Date(`${dayStr}T00:00:00`);
    date.setDate(date.getDate() + dayDelta);
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${m}-${d}`;
  };

  const weekStartString = (date = new Date()) => {
    const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = current.getDay();
    const offset = day === 0 ? 6 : day - 1;
    current.setDate(current.getDate() - offset);
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    return `${current.getFullYear()}-${m}-${d}`;
  };

  const sanitizeMap = (mapObj) => {
    const entries = Object.entries(mapObj || {}).filter((entry) => entry[0]).map(([key, minutes]) => [key, toInt(minutes)]);
    entries.sort((a, b) => b[1] - a[1]);
    return Object.fromEntries(entries.slice(0, MAX_MAP_KEYS));
  };

  const ensureWeek = (mem) => {
    const currentWeekStart = weekStartString();
    if (mem.minutes.week.weekStart !== currentWeekStart) {
      mem.minutes.week.weekStart = currentWeekStart;
      mem.minutes.week.minutes = 0;
      mem.byKeyWeek = {};
      mem.byProgWeek = {};
    }
  };

  const normalize = (raw) => {
    const base = defaultState();
    const mem = raw && typeof raw === 'object' ? raw : {};
    base.active.startedAt = toInt(mem.active?.startedAt, 0) || null;
    base.active.tool = mem.active?.tool === 'progressions' || mem.active?.tool === 'scales' ? mem.active.tool : null;
    base.active.key = typeof mem.active?.key === 'string' ? mem.active.key : null;
    base.active.progressionId = typeof mem.active?.progressionId === 'string' ? mem.active.progressionId : null;

    const daysRaw = Array.isArray(mem.streak?.days) ? mem.streak.days.filter((day) => typeof day === 'string') : [];
    const uniqueDays = [...new Set(daysRaw)].slice(-MAX_DAYS);
    base.streak.days = uniqueDays;
    base.streak.current = toInt(mem.streak?.current);
    base.streak.best = toInt(mem.streak?.best);
    base.streak.lastDay = typeof mem.streak?.lastDay === 'string' ? mem.streak.lastDay : uniqueDays[uniqueDays.length - 1] || null;

    base.minutes.total = toInt(mem.minutes?.total);
    base.minutes.week.weekStart = typeof mem.minutes?.week?.weekStart === 'string' ? mem.minutes.week.weekStart : null;
    base.minutes.week.minutes = toInt(mem.minutes?.week?.minutes);

    base.byKeyWeek = sanitizeMap(mem.byKeyWeek);
    base.byProgWeek = sanitizeMap(mem.byProgWeek);

    ensureWeek(base);

    if (base.streak.best < base.streak.current) base.streak.best = base.streak.current;

    return base;
  };

  const load = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const fresh = normalize(null);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
        return fresh;
      }
      const mem = normalize(JSON.parse(raw));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mem));
      return mem;
    } catch (error) {
      const fresh = normalize(null);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      return fresh;
    }
  };

  const save = (mem) => {
    const clean = normalize(mem);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    return clean;
  };

  const practiceStart = ({ tool, key, progressionId } = {}) => {
    const mem = load();
    ensureWeek(mem);
    const today = todayString();
    const yesterday = shiftDay(today, -1);

    if (!mem.streak.days.includes(today)) {
      mem.streak.days.push(today);
      if (mem.streak.days.length > MAX_DAYS) mem.streak.days = mem.streak.days.slice(-MAX_DAYS);

      if (mem.streak.lastDay === yesterday) mem.streak.current += 1;
      else if (mem.streak.lastDay !== today) mem.streak.current = 1;

      if (mem.streak.current > mem.streak.best) mem.streak.best = mem.streak.current;
      mem.streak.lastDay = today;
    }

    if (!mem.active.startedAt) mem.active.startedAt = Math.floor(Date.now() / 1000);
    mem.active.tool = tool === 'progressions' || tool === 'scales' ? tool : null;
    mem.active.key = key || null;
    mem.active.progressionId = progressionId || null;

    return save(mem);
  };

  const practicePauseOrStop = () => {
    const mem = load();
    ensureWeek(mem);
    if (!mem.active.startedAt) return save(mem);

    const nowSec = Math.floor(Date.now() / 1000);
    const elapsedSec = Math.max(0, nowSec - mem.active.startedAt);
    if (elapsedSec >= 30) {
      const addMinutes = Math.floor(elapsedSec / 60);
      if (addMinutes > 0) {
        mem.minutes.total += addMinutes;
        mem.minutes.week.minutes += addMinutes;
        if (mem.active.key) mem.byKeyWeek[mem.active.key] = toInt(mem.byKeyWeek[mem.active.key]) + addMinutes;
        if (mem.active.progressionId) mem.byProgWeek[mem.active.progressionId] = toInt(mem.byProgWeek[mem.active.progressionId]) + addMinutes;
      }
    }

    mem.active.startedAt = null;
    mem.byKeyWeek = sanitizeMap(mem.byKeyWeek);
    mem.byProgWeek = sanitizeMap(mem.byProgWeek);
    return save(mem);
  };

  const getTopEntry = (mapObj) => {
    const entries = Object.entries(mapObj || {}).sort((a, b) => b[1] - a[1]);
    if (!entries.length || !entries[0][1]) return null;
    return { name: entries[0][0], minutes: toInt(entries[0][1]) };
  };

  const getSummary = () => {
    const mem = load();
    return {
      streak: {
        current: toInt(mem.streak.current),
        best: toInt(mem.streak.best),
      },
      weekMinutes: toInt(mem.minutes.week.minutes),
      totalMinutes: toInt(mem.minutes.total),
      topKeyWeek: getTopEntry(mem.byKeyWeek),
      topProgWeek: getTopEntry(mem.byProgWeek),
    };
  };

  return {
    load,
    save,
    practiceStart,
    practicePauseOrStop,
    getSummary,
  };
})();
