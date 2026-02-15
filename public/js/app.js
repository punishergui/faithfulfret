// Daily Fret — App Bootstrap
// Handles: update banner, hamburger nav, version check

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

  async function checkVersion() {
    if (bannerDismissed) return;
    try {
      const res = await fetch('/api/version');
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
      updateBtn.innerHTML = '<span class="spinner"></span>Updating...';

      try {
        const res = await fetch('/api/update', { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
          updateBtn.textContent = 'Restarting...';
          setTimeout(() => location.reload(), 3000);
        } else {
          updateBtn.textContent = 'Error — refresh manually';
          updateBtn.disabled = false;
        }
      } catch (e) {
        updateBtn.textContent = 'Restarting...';
        setTimeout(() => location.reload(), 3000);
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

  // Global Pages namespace — pages register themselves
  window.Pages = window.Pages || {};
})();
