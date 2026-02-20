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

    async getFeed(limit = 50) {
      const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(Number(limit), 200)) : 50;
      return api(`/api/feed?limit=${safeLimit}`);
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





    async getTrainingProviders() { return api('/api/training/providers'); },
    async saveTrainingProvider(data) {
      if (data.id) return api(`/api/training/providers/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });
      return api('/api/training/providers', { method: 'POST', body: JSON.stringify(data) });
    },
    async deleteTrainingProvider(id) { return api(`/api/training/providers/${id}`, { method: 'DELETE' }); },
    async getTrainingLevels(providerId) {
      const q = providerId ? `?provider_id=${encodeURIComponent(providerId)}` : '';
      return api(`/api/training/levels${q}`);
    },
    async createTrainingDefaultLevels(provider_id) { return api('/api/training/levels/bootstrap', { method: 'POST', body: JSON.stringify({ provider_id }) }); },
    async getTrainingModules(levelId) {
      const q = levelId ? `?level_id=${encodeURIComponent(levelId)}` : '';
      return api(`/api/training/modules${q}`);
    },
    async saveTrainingModule(data) {
      if (data.id) return api(`/api/training/modules/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });
      return api('/api/training/modules', { method: 'POST', body: JSON.stringify(data) });
    },
    async getTrainingLessons(filters = {}) {
      const params = new URLSearchParams();
      Object.entries(filters || {}).forEach(([k, v]) => { if (v != null && v !== '') params.set(k, String(v)); });
      const q = params.toString();
      return api(`/api/training/lessons${q ? `?${q}` : ''}`);
    },
    async getTrainingLesson(id) { return api(`/api/training/lessons/${id}`); },
    async saveTrainingLesson(data) {
      if (data.id) return api(`/api/training/lessons/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });
      return api('/api/training/lessons', { method: 'POST', body: JSON.stringify(data) });
    },
    async deleteTrainingLesson(id) { return api(`/api/training/lessons/${id}`, { method: 'DELETE' }); },
    async getTrainingSkillGroups() { return api('/api/training/skill-groups'); },
    async getTrainingSkillLessons(slug) { return api(`/api/training/skills/${encodeURIComponent(slug)}/lessons`); },
    async getTrainingSongs(filters = {}) {
      const params = new URLSearchParams();
      Object.entries(filters || {}).forEach(([k, v]) => { if (v != null && v !== '') params.set(k, String(v)); });
      const q = params.toString();
      return api(`/api/training/songs${q ? `?${q}` : ''}`);
    },
    async getTrainingSong(id) { return api(`/api/training/songs/${id}`); },
    async saveTrainingSong(data) {
      if (data.id) return api(`/api/training/songs/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });
      return api('/api/training/songs', { method: 'POST', body: JSON.stringify(data) });
    },
    async deleteTrainingSong(id) { return api(`/api/training/songs/${id}`, { method: 'DELETE' }); },
    async assignTrainingSongLessons(id, lesson_ids = []) { return api(`/api/training/songs/${id}/lessons`, { method: 'POST', body: JSON.stringify({ lesson_ids }) }); },

    async getProviders() { return api('/api/providers'); },
    async saveProvider(data) {
      return data.id ? api(`/api/providers/${data.id}`, { method: 'PUT', body: JSON.stringify(data) }) : api('/api/providers', { method: 'POST', body: JSON.stringify(data) });
    },
    async getCourses(providerId) {
      const q = providerId ? `?providerId=${encodeURIComponent(providerId)}` : '';
      return api(`/api/courses${q}`);
    },
    async saveCourse(data) { return api('/api/courses', { method: 'POST', body: JSON.stringify(data) }); },
    async getModules(courseId) {
      const q = courseId ? `?courseId=${encodeURIComponent(courseId)}` : '';
      return api(`/api/modules${q}`);
    },
    async saveModule(data) { return api('/api/modules', { method: 'POST', body: JSON.stringify(data) }); },
    async getLessons(filters = {}) {
      const params = new URLSearchParams();
      Object.entries(filters || {}).forEach(([key, value]) => {
        if (value == null || value === '') return;
        params.set(key, String(value));
      });
      const query = params.toString();
      return api(`/api/lessons${query ? `?${query}` : ''}`);
    },
    async getLesson(id) { return api(`/api/lessons/${id}`); },
    async saveLesson(data) {
      return data.id ? api(`/api/lessons/${data.id}`, { method: 'PUT', body: JSON.stringify(data) }) : api('/api/lessons', { method: 'POST', body: JSON.stringify(data) });
    },
    async deleteLesson(id) { return api(`/api/lessons/${id}`, { method: 'DELETE' }); },
    async getLessonStats(id) { return api(`/api/lesson-stats/${id}`); },
    async createTrainingSession(data = {}) { return api('/api/sessions', { method: 'POST', body: JSON.stringify(data) }); },
    async addSessionItem(sessionId, data) { return api(`/api/sessions/${sessionId}/items`, { method: 'POST', body: JSON.stringify(data) }); },
    async updateSessionItem(id, data) { return api(`/api/session-items/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
    async deleteSessionItem(id) { return api(`/api/session-items/${id}`, { method: 'DELETE' }); },
    async finishTrainingSession(sessionId) { return api(`/api/sessions/${sessionId}/finish`, { method: 'PUT' }); },
    async getTrainingSession(id) { return api(`/api/sessions/${id}`); },
    async getAttachments(entityType, entityId) { return api(`/api/attachments?entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(entityId)}`); },
    async uploadAttachment({ entity_type, entity_id, caption, file }) {
      const form = new FormData();
      form.append('entity_type', entity_type);
      form.append('entity_id', String(entity_id));
      if (caption) form.append('caption', caption);
      form.append('file', file);
      const res = await fetch('/api/attachments', { method: 'POST', body: form });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `Request failed: ${res.status}`);
      return JSON.parse(text);
    },
    async deleteAttachment(id) { return api(`/api/attachments/${id}`, { method: 'DELETE' }); },

    async getTrainingPlaylists() { return api('/api/training-playlists'); },
    async getTrainingPlaylist(id) {
      try { return await api(`/api/training-playlists/${id}`); } catch { return null; }
    },
    async saveTrainingPlaylist(data) {
      return data.id
        ? api(`/api/training-playlists/${data.id}`, { method: 'PUT', body: JSON.stringify(data) })
        : api('/api/training-playlists', { method: 'POST', body: JSON.stringify(data) });
    },
    async deleteTrainingPlaylist(id) { return api(`/api/training-playlists/${id}`, { method: 'DELETE' }); },
    async getTrainingPlaylistItems(id) { return api(`/api/training-playlists/${id}/items`); },
    async replaceTrainingPlaylistItems(id, items) {
      return api(`/api/training-playlists/${id}/items`, { method: 'PUT', body: JSON.stringify({ items }) });
    },

    // Training Videos
    async fetchOEmbed(url) {
      return api(`/api/oembed?url=${encodeURIComponent(url || '')}`);
    },

    async fetchTrainingVideoMetadata(url) {
      return api('/api/training/videos/metadata', { method: 'POST', body: JSON.stringify({ url: url || '' }) });
    },

    async getAllTrainingVideos(filters = {}) {
      const params = new URLSearchParams();
      const merged = { includeProgress: 1, ...(filters || {}) };
      Object.entries(merged).forEach(([key, value]) => {
        if (value == null || value === '') return;
        params.set(key, String(value));
      });
      const query = params.toString();
      return api(`/api/training-videos${query ? `?${query}` : ''}`);
    },

    async getTrainingVideo(id) {
      try { return await api(`/api/training-videos/${id}`); } catch { return null; }
    },

    async saveTrainingVideo(data) {
      return data.id
        ? api(`/api/training-videos/${data.id}`, { method: 'PUT', body: JSON.stringify(data) })
        : api('/api/training-videos', { method: 'POST', body: JSON.stringify(data) });
    },

    async deleteTrainingVideo(id) {
      return api(`/api/training-videos/${id}`, { method: 'DELETE' });
    },

    async getTrainingVideoProgress(id) {
      return api(`/api/training/videos/${id}/progress`);
    },

    async saveTrainingVideoProgress(id, data = {}) {
      return api(`/api/training/videos/${id}/progress`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async addVideoTimestamp(videoId, data) {
      return api(`/api/training-videos/${videoId}/timestamps`, { method: 'POST', body: JSON.stringify(data) });
    },

    async deleteVideoTimestamp(id) {
      return api(`/api/video-timestamps/${id}`, { method: 'DELETE' });
    },

    async getVideoPlaylists(options = {}) {
      const params = new URLSearchParams();
      if (options.scope) params.set('scope', String(options.scope));
      if (options.q) params.set('q', String(options.q));
      const query = params.toString();
      return api(`/api/video-playlists${query ? `?${query}` : ''}`);
    },

    async getVideoPlaylistGroups() {
      return api('/api/video-playlist-groups');
    },

    async getVideoPlaylist(id) {
      return api(`/api/video-playlists/${id}`);
    },

    async saveVideoPlaylist(data) {
      return data.id
        ? api(`/api/video-playlists/${data.id}`, { method: 'PUT', body: JSON.stringify(data) })
        : api('/api/video-playlists', { method: 'POST', body: JSON.stringify(data) });
    },

    async patchTrainingPlaylist(id, data) {
      return api(`/api/training/playlists/${id}`, { method: 'PATCH', body: JSON.stringify(data || {}) });
    },

    async deleteVideoPlaylist(id) {
      return api(`/api/video-playlists/${id}`, { method: 'DELETE' });
    },

    async replaceVideoPlaylistItems(id, items) {
      return api(`/api/video-playlists/${id}/items`, { method: 'PUT', body: JSON.stringify({ items }) });
    },

    async addTrainingPlaylistItem(id, data) {
      return api(`/api/training/playlists/${id}/items`, { method: 'POST', body: JSON.stringify(data || {}) });
    },

    async deleteTrainingPlaylistItem(id, itemId) {
      return api(`/api/training/playlists/${id}/items/${itemId}`, { method: 'DELETE' });
    },

    async unnestTrainingPlaylist(parentId, childPlaylistId) {
      return api(`/api/training/playlists/${parentId}/unnest`, { method: 'POST', body: JSON.stringify({ child_playlist_id: Number(childPlaylistId) || 0 }) });
    },

    async getTrainingPlaylistDetail(id) {
      return api(`/api/training/playlists/${id}`);
    },

    async getTrainingPlaylistVideoAssignments() {
      return api('/api/training/playlists/video-assignments');
    },

    async getVideoAttachments(videoId) {
      return api(`/api/videos/${videoId}/attachments`);
    },

    async saveVideoAttachment(videoId, data = {}) {
      if (data.file) {
        const form = new FormData();
        form.append('file', data.file);
        if (data.title) form.append('title', data.title);
        const res = await fetch(`/api/videos/${videoId}/attachments`, { method: 'POST', body: form });
        const text = await res.text();
        if (!res.ok) throw new Error(text || `Request failed: ${res.status}`);
        return JSON.parse(text);
      }
      return api(`/api/videos/${videoId}/attachments`, { method: 'POST', body: JSON.stringify({ title: data.title || '', url: data.url || '' }) });
    },

    async deleteVideoAttachment(id) {
      return api(`/api/video-attachments/${id}`, { method: 'DELETE' });
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
