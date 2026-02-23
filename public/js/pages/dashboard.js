window.Pages = window.Pages || {};

window.Pages.Dashboard = {
  render() {
    document.getElementById('app').innerHTML = `
      <section class="panel">
        <h1>Dashboard</h1>
        <p>Welcome to CRATE. Use Scan Report to inspect skipped files and launch scans directly in-app.</p>
      </section>
      <section class="panel">
        <h2>Quick Actions</h2>
        <p><a href="#/scan-report">Open Scan Report</a> · <a href="#/settings">Pick Theme</a></p>
      </section>
    `;
  }
};
