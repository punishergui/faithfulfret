// Daily Fret — App Bootstrap
// Handles: update banner, hamburger nav, version check, cache refresh

(function() {
  const hamburger = document.getElementById('nav-hamburger');
  const mobileMenu = document.getElementById('nav-mobile-menu');

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      mobileMenu.classList.toggle('open');
    });

    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => mobileMenu.classList.remove('open'));
    });
  }

  const banner = document.getElementById('update-banner');
  const updateBtn = document.getElementById('update-btn');
  const updateRepoLink = document.getElementById('update-repo-link');
  const dismissBtn = document.getElementById('update-dismiss');

  const helpModal = document.getElementById('sync-help-modal');
  const helpSummary = document.getElementById('sync-help-summary');
  const helpOutput = document.getElementById('sync-help-output');
  const helpClose = document.getElementById('sync-help-close');
  const helpCopy = document.getElementById('sync-help-copy');
  const helpRefresh = document.getElementById('sync-help-refresh');

  let bannerDismissed = false;
  let latestHelpCommands = [];

  function openHelpModal(summary, output, commands = []) {
    if (!helpModal) return;
    helpSummary.textContent = summary || 'Update helper';
    helpOutput.textContent = output || '';
    latestHelpCommands = commands;
    helpModal.classList.add('open');
    helpModal.setAttribute('aria-hidden', 'false');
  }

  function closeHelpModal() {
    if (!helpModal) return;
    helpModal.classList.remove('open');
    helpModal.setAttribute('aria-hidden', 'true');
  }

  helpClose?.addEventListener('click', closeHelpModal);
  helpModal?.addEventListener('click', (e) => {
    if (e.target === helpModal) closeHelpModal();
  });
  helpCopy?.addEventListener('click', async () => {
    const txt = latestHelpCommands.join('\n');
    if (!txt) return;
    await navigator.clipboard.writeText(txt);
    helpCopy.textContent = 'Copied';
    setTimeout(() => helpCopy.textContent = 'Copy commands', 1200);
  });

  async function clearRuntimeCaches() {
    if (!('caches' in window)) return;
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  }

  async function refreshServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
  }

  async function hardRefreshApp() {
    try {
      await clearRuntimeCaches();
      await refreshServiceWorker();
    } catch (e) {
      console.warn('Hard refresh cleanup failed', e);
    }
    location.reload();
  }

  helpRefresh?.addEventListener('click', hardRefreshApp);

  async function fetchUpdateHelp() {
    try {
      const res = await fetch('/api/update/help', { cache: 'no-store' });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }

  async function checkVersion() {
    if (bannerDismissed) return;
    try {
      const res = await fetch('/api/version', { cache: 'no-store' });
      const data = await res.json();
      if (data.updateAvailable) {
        if (data.repoUrl && updateRepoLink) updateRepoLink.href = data.repoUrl;
        banner.classList.add('visible');
      }
    } catch {
      // ignore
    }
  }

  if (updateBtn) {
    updateBtn.addEventListener('click', async () => {
      updateBtn.disabled = true;
      updateBtn.innerHTML = '<span class="spinner"></span>Syncing...';

      const help = await fetchUpdateHelp();

      try {
        const res = await fetch('/api/update', { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
          updateBtn.textContent = 'Applying update...';
          openHelpModal(
            '✅ Sync complete. The app will now hard-refresh caches so you see the newest version.',
            data.output || 'Update completed.',
            help?.commands || []
          );
          setTimeout(() => hardRefreshApp(), 3500);
        } else {
          updateBtn.textContent = 'Update failed';
          updateBtn.disabled = false;
          openHelpModal(
            '❌ Sync failed. Use these exact commands to force sync manually.',
            data.error || 'Unknown update error',
            help?.commands || []
          );
        }
      } catch (e) {
        updateBtn.textContent = 'Retry update';
        updateBtn.disabled = false;
        openHelpModal(
          '⚠️ Could not reach update endpoint. Use manual force-sync commands below.',
          String(e?.message || e),
          help?.commands || []
        );
      }
    });
  }

  dismissBtn?.addEventListener('click', () => {
    bannerDismissed = true;
    banner.classList.remove('visible');
  });

  checkVersion();
  setInterval(checkVersion, 5 * 60 * 1000);

  if ('serviceWorker' in navigator) {
    setInterval(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        await reg?.update();
      } catch {
        // ignore
      }
    }, 60 * 1000);
  }

  window.Pages = window.Pages || {};
})();
