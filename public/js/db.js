// Daily Fret — API DB Wrapper
// Exposes window.DB

(async function initDB() {
  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || `Request failed: ${res.status}`);
    }
    return res.json();
  }

  function normalizeSession(row) {
    if (!row) return row;
    return {
      ...row,
      minutes: row.minutes ?? row.durationMinutes ?? null,
      videoId: row.videoId || row.youtubeId || '',
      focus: row.focus || row.focusTag || row.title || '',
    };
  }

  window.DB = {
    // Sessions
    async saveSess(data) {
      const payload = {
        ...data,
        durationMinutes: data.durationMinutes ?? data.minutes,
        youtubeId: data.youtubeId ?? data.videoId,
        focusTag: data.focusTag ?? data.focus,
      };
      const row = data.id
        ? await api(`/api/sessions/${data.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        : await api('/api/sessions', { method: 'POST', body: JSON.stringify(payload) });
      return normalizeSession(row);
    },

    async getSess(id) {
      try {
        const row = await api(`/api/sessions/${id}`);
        return normalizeSession(row);
      } catch {
        return null;
      }
    },

    async getSessByDate(date) {
      const all = await this.getAllSess();
      return all.find(x => x.date === date) || null;
    },

    async getAllSess() {
      const rows = await api('/api/sessions');
      return rows.map(normalizeSession);
    },

    async deleteSess(id) {
      return api(`/api/sessions/${id}`, { method: 'DELETE' });
    },

    // Gear
    async saveGear(data) {
      return data.id
        ? api(`/api/gear-items/${data.id}`, { method: 'PUT', body: JSON.stringify(data) })
        : api('/api/gear-items', { method: 'POST', body: JSON.stringify(data) });
    },

    async getGear(id) {
      try { return await api(`/api/gear-items/${id}`); } catch { return null; }
    },

    async getAllGear() {
      return api('/api/gear-items');
    },

    async deleteGear(id) {
      return api(`/api/gear-items/${id}`, { method: 'DELETE' });
    },

    // Presets
    async savePreset(data) {
      return data.id
        ? api(`/api/presets/${data.id}`, { method: 'PUT', body: JSON.stringify(data) })
        : api('/api/presets', { method: 'POST', body: JSON.stringify(data) });
    },
    async getPreset(id) {
      try { return await api(`/api/presets/${id}`); } catch { return null; }
    },
    async getAllPresets() {
      return api('/api/presets');
    },
    async deletePreset(id) {
      return api(`/api/presets/${id}`, { method: 'DELETE' });
    },

    // Resources legacy
    async saveResource(data) {
      return data.id
        ? api(`/api/resources/${data.id}`, { method: 'PUT', body: JSON.stringify(data) })
        : api('/api/resources', { method: 'POST', body: JSON.stringify(data) });
    },
    async getResource(id) {
      try { return await api(`/api/resources/${id}`); } catch { return null; }
    },
    async getAllResources() {
      return api('/api/resources');
    },
    async deleteResource(id) {
      return api(`/api/resources/${id}`, { method: 'DELETE' });
    },

    async getStats() {
      const sessions = await this.getAllSess();
      const count = sessions.length;
      const totalMinutes = sessions.reduce((s, x) => s + (x.minutes || 0), 0);
      const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
      const bpms = sessions.filter(x => x.bpm).map(x => x.bpm);
      const maxBPM = bpms.length ? Math.max(...bpms) : 0;
      const avgBPM = bpms.length ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length) : 0;

      const allDates = sessions.map(s => s.date).filter(Boolean).sort().reverse();
      const uniqueDatesDesc = [...new Set(allDates)];
      const uniqueDatesAsc = [...uniqueDatesDesc].reverse();

      const toDate = (ymd) => new Date(`${ymd}T12:00:00`);
      const dayDiff = (a, b) => Math.round((toDate(a) - toDate(b)) / 86400000);

      let currentStreak = 0;
      const today = new Date().toISOString().split('T')[0];
      if (uniqueDatesDesc.length) {
        const first = uniqueDatesDesc[0];
        const offset = dayDiff(today, first);
        if (offset === 0 || offset === 1) {
          currentStreak = 1;
          for (let i = 1; i < uniqueDatesDesc.length; i++) {
            if (dayDiff(uniqueDatesDesc[i - 1], uniqueDatesDesc[i]) === 1) currentStreak++;
            else break;
          }
        }
      }

      let longestStreak = 0;
      let run = 0;
      for (let i = 0; i < uniqueDatesAsc.length; i++) {
        if (i === 0) run = 1;
        else if (dayDiff(uniqueDatesAsc[i], uniqueDatesAsc[i - 1]) === 1) run++;
        else run = 1;
        if (run > longestStreak) longestStreak = run;
      }

      const lastSessionDate = uniqueDatesDesc[0] || null;
      const daysSinceLastSession = lastSessionDate ? Math.max(0, dayDiff(today, lastSessionDate)) : null;

      const sessionsPerWeek = count ? Math.round((count / Math.max(1, new Set(uniqueDatesDesc.map(d => d.slice(0, 8))).size / 7)) * 10) / 10 : 0;

      return {
        count,
        totalMinutes,
        totalHours,
        maxBPM,
        avgBPM,
        streak: currentStreak,
        currentStreak,
        longestStreak,
        lastSessionDate,
        daysSinceLastSession,
        allDates,
        sessionsPerWeek,
      };
    },

    async exportAll() {
      return api('/api/export');
    },

    async importAll(data) {
      return api('/api/import', { method: 'POST', body: JSON.stringify(data) });
    },
  };

  window.dispatchEvent(new Event('db-ready'));
})();
