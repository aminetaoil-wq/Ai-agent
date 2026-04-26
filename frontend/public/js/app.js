// Bootstrap: wire global click handlers and decide the initial screen.
(function () {
  document.addEventListener('click', (e) => {
    const goEl = e.target.closest('[data-go]');
    if (goEl) {
      window.Router.go(goEl.dataset.go);
      return;
    }
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    if (action === 'open-login') {
      // Default to login tab.
      const loginTab = document.querySelector('.rtab[data-tab="login"]');
      if (loginTab) loginTab.click();
      window.Router.go('sc-auth');
    } else if (action === 'open-register-client' || action === 'open-register-craftsman') {
      const registerTab = document.querySelector('.rtab[data-tab="register"]');
      if (registerTab) registerTab.click();
      const role = action === 'open-register-craftsman' ? 'CRAFTSMAN' : 'CLIENT';
      const card = document.querySelector(`.oc[data-role="${role}"]`);
      if (card) card.click();
      window.Router.go('sc-auth');
    } else if (action === 'logout') {
      const refreshToken = window.Store.refreshToken;
      window.Store.clear();
      if (refreshToken) window.API.logout(refreshToken).catch(() => {});
      window.toast('Uitgelogd');
      window.Router.go('sc-home');
    } else if (action === 'back-to-job') {
      window.Router.go('sc-job');
    }
  });

  async function init() {
    // Pre-fetch categories so the new-job form is instant.
    try {
      const { categories } = await window.API.listCategories();
      window.Store.categories = categories;
    } catch (_) { /* offline ok */ }

    if (window.Store.isAuthed()) {
      try {
        const { user } = await window.API.me();
        window.Store.setUser(user);
        window.Router.go('sc-dash');
      } catch (_) {
        window.Store.clear();
        window.Router.go('sc-home');
      }
    } else {
      window.Router.go('sc-home');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
