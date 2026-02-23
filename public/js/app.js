(function () {
  const indicator = document.getElementById('scan-indicator');
  const indicatorText = document.getElementById('scan-indicator-text');
  const searchInput = document.getElementById('global-search');
  let timer;

  function paintStatus(status) {
    const running = status?.status === 'running';
    indicator?.classList.toggle('running', running);
    indicatorText.textContent = running ? 'Running' : 'Idle';
  }

  async function pullStatus() {
    try {
      const res = await fetch('/api/scan/status');
      const status = await res.json();
      paintStatus(status);
      clearTimeout(timer);
      timer = setTimeout(pullStatus, status.status === 'running' ? 1000 : 10000);
    } catch {
      clearTimeout(timer);
      timer = setTimeout(pullStatus, 10000);
    }
  }

  window.AppScan = {
    setStatus(status) { paintStatus(status); }
  };

  searchInput?.addEventListener('change', () => {
    window.dispatchEvent(new CustomEvent('global-search', { detail: searchInput.value }));
  });

  pullStatus();
})();
