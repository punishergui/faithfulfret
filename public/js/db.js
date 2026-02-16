// Daily Fret — API DB Wrapper
// Exposes window.DB

(async function initDB() {
  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const text = await res.text();

    if (!res.ok) {
      throw new Error(text || `Request failed: ${res.status}`);
    }

    if (!contentType.includes('application/json')) {
      throw new Error(`Expected JSON response from ${path} but received ${contentType || 'unknown content type'}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON response from ${path}`);
    }
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
      return api('/api/stats');
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
