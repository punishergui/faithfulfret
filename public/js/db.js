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


  function readLocalSettings() {
    const settings = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      settings[key] = localStorage.getItem(key);
    }
    return settings;
  }

  function writeLocalSettings(settings = {}) {
    Object.entries(settings || {}).forEach(([key, value]) => {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, String(value));
    });
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

    async getSessionHeatmap() {
      return api('/api/session-heatmap');
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

    async getAllGear(includeLinks = true) {
      return api(`/api/gear-items?includeLinks=${includeLinks ? 'true' : 'false'}`);
    },

    async getGearLinks(gearId) {
      return api(`/api/gear-items/${gearId}/links`);
    },

    async saveGearLink(gearId, data) {
      return data.id
        ? api(`/api/gear-items/${gearId}/links/${data.id}`, { method: 'PUT', body: JSON.stringify(data) })
        : api(`/api/gear-items/${gearId}/links`, { method: 'POST', body: JSON.stringify(data) });
    },

    async deleteGearLink(gearId, linkId) {
      return api(`/api/gear-items/${gearId}/links/${linkId}`, { method: 'DELETE' });
    },

    async deleteGear(id) {
      return api(`/api/gear-items/${id}`, { method: 'DELETE' });
    },

    async saveSessionGear(sessionId, gearIds) {
      return api(`/api/sessions/${sessionId}/gear`, { method: 'PUT', body: JSON.stringify({ gearIds }) });
    },

    async getSessionGear(sessionId) {
      return api(`/api/sessions/${sessionId}/gear`);
    },

    async getGearUsage() {
      return api('/api/gear-usage');
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
    async uploadPresetImage(payload) {
      return api('/api/preset-image', { method: 'POST', body: JSON.stringify(payload) });
    },
    async uploadPresetAudio(presetId, file, fileName = 'recording.webm') {
      const form = new FormData();
      form.append('file', file, fileName);
      const res = await fetch(`/api/presets/${presetId}/audio`, { method: 'POST', body: form });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `Request failed: ${res.status}`);
      try { return JSON.parse(text); } catch { throw new Error('Invalid JSON response from preset audio upload'); }
    },
    async deletePresetAudio(presetId) {
      return api(`/api/presets/${presetId}/audio`, { method: 'DELETE' });
    },

    async uploadGearImage(payload) {
      return api('/api/gear-image', { method: 'POST', body: JSON.stringify(payload) });
    },

    async getGearImages(gearId) {
      return api(`/api/gear/${gearId}/images`);
    },

    async deleteGearImage(imageId) {
      return api(`/api/gear-image/${imageId}`, { method: 'DELETE' });
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
      const payload = await api('/api/backup/export');
      payload.localSettings = readLocalSettings();
      return payload;
    },

    async exportAllZip() {
      const res = await fetch('/api/export/zip');
      if (!res.ok) throw new Error(await res.text() || `Request failed: ${res.status}`);
      return res.blob();
    },

    async importZip(file) {
      const form = new FormData();
      form.append('backupZip', file);
      const res = await fetch('/api/import/zip', { method: 'POST', body: form });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `Request failed: ${res.status}`);
      try { return JSON.parse(text); } catch { throw new Error('Invalid JSON response from /api/import/zip'); }
    },

    async getDbInfo() {
      return api('/api/db-info');
    },

    async importAll(data) {
      const result = await api('/api/backup/import', { method: 'POST', body: JSON.stringify(data) });
      if (data && data.localSettings && typeof data.localSettings === 'object') writeLocalSettings(data.localSettings);
      if (window.Utils?.setTheme) window.Utils.setTheme(localStorage.getItem('theme') || (window.FF_THEME_DEFAULT || 'backroom-amp'));
      return result;
    },
  };

  window.__DB_READY__ = true;
  window.dispatchEvent(new Event('db-ready'));
})();
