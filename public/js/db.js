// Daily Fret — IndexedDB Wrapper
// Exposes window.DB
// Depends on idb UMD loaded before this script

(async function initDB() {
  // Wait for idb to be available
  const idb = window.idb;
  if (!idb) {
    console.error('idb library not loaded');
    return;
  }

  const DB_NAME = 'daily-fret-db';
  const DB_VERSION = 1;

  const db = await idb.openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Sessions store
      if (!db.objectStoreNames.contains('sessions')) {
        const sessStore = db.createObjectStore('sessions', { keyPath: 'id' });
        sessStore.createIndex('date', 'date', { unique: true });
        sessStore.createIndex('createdAt', 'createdAt');
      }

      // Gear store
      if (!db.objectStoreNames.contains('gear')) {
        const gearStore = db.createObjectStore('gear', { keyPath: 'id' });
        gearStore.createIndex('category', 'category');
      }

      // Resources store
      if (!db.objectStoreNames.contains('resources')) {
        const resStore = db.createObjectStore('resources', { keyPath: 'id' });
        resStore.createIndex('category', 'category');
        resStore.createIndex('rating', 'rating');
      }
    },
  });

  window.DB = {
    // ────────────────────────────────────────────────
    // SESSIONS
    // ────────────────────────────────────────────────
    async saveSess(data) {
      if (!data.id) data.id = crypto.randomUUID();
      if (!data.createdAt) data.createdAt = Date.now();
      await db.put('sessions', data);
      return data;
    },

    async getSess(id) {
      return db.get('sessions', id);
    },

    async getSessByDate(date) {
      return db.getFromIndex('sessions', 'date', date);
    },

    async getAllSess() {
      const all = await db.getAll('sessions');
      return all.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    },

    async deleteSess(id) {
      return db.delete('sessions', id);
    },

    // ────────────────────────────────────────────────
    // GEAR
    // ────────────────────────────────────────────────
    async saveGear(data) {
      if (!data.id) data.id = crypto.randomUUID();
      if (!data.createdAt) data.createdAt = Date.now();
      await db.put('gear', data);
      return data;
    },

    async getGear(id) {
      return db.get('gear', id);
    },

    async getAllGear() {
      const all = await db.getAll('gear');
      return all.sort((a, b) => {
        const catCmp = (a.category || '').localeCompare(b.category || '');
        if (catCmp !== 0) return catCmp;
        return (a.name || '').localeCompare(b.name || '');
      });
    },

    async deleteGear(id) {
      return db.delete('gear', id);
    },

    // ────────────────────────────────────────────────
    // RESOURCES
    // ────────────────────────────────────────────────
    async saveResource(data) {
      if (!data.id) data.id = crypto.randomUUID();
      if (!data.createdAt) data.createdAt = Date.now();
      await db.put('resources', data);
      return data;
    },

    async getResource(id) {
      return db.get('resources', id);
    },

    async getAllResources() {
      const all = await db.getAll('resources');
      return all.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    },

    async deleteResource(id) {
      return db.delete('resources', id);
    },

    // ────────────────────────────────────────────────
    // STATS
    // ────────────────────────────────────────────────
    async getStats() {
      const sessions = await this.getAllSess();
      const count = sessions.length;
      const totalMinutes = sessions.reduce((s, x) => s + (x.minutes || 0), 0);
      const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
      const bpms = sessions.filter(x => x.bpm).map(x => x.bpm);
      const maxBPM = bpms.length ? Math.max(...bpms) : 0;
      const avgBPM = bpms.length ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length) : 0;

      // Streak calculation
      const allDates = sessions.map(s => s.date).filter(Boolean).sort().reverse();
      let streak = 0;
      if (allDates.length) {
        const today = new Date().toISOString().split('T')[0];
        let check = allDates[0] === today ? today : null;

        if (check) {
          streak = 1;
          let prev = new Date(today + 'T12:00:00');
          for (let i = 1; i < allDates.length; i++) {
            prev.setDate(prev.getDate() - 1);
            const expected = prev.toISOString().split('T')[0];
            if (allDates[i] === expected) {
              streak++;
            } else {
              break;
            }
          }
        }
      }

      return { count, totalMinutes, totalHours, maxBPM, avgBPM, streak, allDates };
    },

    // ────────────────────────────────────────────────
    // EXPORT / IMPORT
    // ────────────────────────────────────────────────
    async exportAll() {
      const [sessions, gear, resources] = await Promise.all([
        this.getAllSess(),
        this.getAllGear(),
        this.getAllResources(),
      ]);
      return { sessions, gear, resources, exportedAt: new Date().toISOString() };
    },

    async importAll(data) {
      const tx = db.transaction(['sessions', 'gear', 'resources'], 'readwrite');
      await tx.objectStore('sessions').clear();
      await tx.objectStore('gear').clear();
      await tx.objectStore('resources').clear();

      for (const item of (data.sessions || [])) {
        await tx.objectStore('sessions').put(item);
      }
      for (const item of (data.gear || [])) {
        await tx.objectStore('gear').put(item);
      }
      for (const item of (data.resources || [])) {
        await tx.objectStore('resources').put(item);
      }
      await tx.done;
    },
  };

  // Emit event so app.js knows DB is ready
  window.dispatchEvent(new Event('db-ready'));
})();
