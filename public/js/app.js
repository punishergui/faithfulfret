// Daily Fret — App Bootstrap
// Handles: update banner, hamburger nav, version check, cache refresh

(function() {
  // Hamburger nav
  const hamburger = document.getElementById('nav-hamburger');
  const mobileMenu = document.getElementById('nav-mobile-menu');

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      mobileMenu.classList.toggle('open');
    });

    // Close mobile menu on link click
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => mobileMenu.classList.remove('open'));
    });
  }

  // Update banner logic
  const banner = document.getElementById('update-banner');
  const updateBtn = document.getElementById('update-btn');
  const updateRepoLink = document.getElementById('update-repo-link');
  const dismissBtn = document.getElementById('update-dismiss');

  let bannerDismissed = false;

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

  async function checkVersion() {
    if (bannerDismissed) return;
    try {
      const res = await fetch('/api/version', { cache: 'no-store' });
      const data = await res.json();
      if (data.updateAvailable) {
        if (data.repoUrl && updateRepoLink) {
          updateRepoLink.href = data.repoUrl;
        }
        banner.classList.add('visible');
      }
    } catch (e) {
      // No network or no git — silently ignore
    }
  }

  if (updateBtn) {
    updateBtn.addEventListener('click', async () => {
      updateBtn.disabled = true;
      updateBtn.innerHTML = '<span class="spinner"></span>Syncing...';

      try {
        const res = await fetch('/api/update', { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
          updateBtn.textContent = 'Applying update...';
          setTimeout(() => {
            hardRefreshApp();
          }, 2500);
        } else {
          updateBtn.textContent = 'Update failed';
          updateBtn.disabled = false;
        }
      } catch (e) {
        updateBtn.textContent = 'Retry update';
        updateBtn.disabled = false;
      }
    });
  }

  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      bannerDismissed = true;
      banner.classList.remove('visible');
    });
  }

  // Check for updates every 5 minutes
  checkVersion();
  setInterval(checkVersion, 5 * 60 * 1000);

  // Also check SW update every minute so deployments are picked up quickly.
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

  // Global Pages namespace — pages register themselves
  window.Pages = window.Pages || {};
})();
