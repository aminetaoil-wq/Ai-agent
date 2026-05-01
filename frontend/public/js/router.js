// Minimal screen router. Each screen is a <section class="sc"> with a unique id.
// Calling Router.go(id) hides all and shows the requested one, then dispatches
// a 'screen:enter' event so screen handlers can fetch fresh data.
(function () {
  const PUBLIC_SCREENS = new Set(['sc-home', 'sc-auth']);

  const Router = {
    current: 'sc-home',

    go(id, payload) {
      const auth = window.Store?.isAuthed();
      if (!auth && !PUBLIC_SCREENS.has(id)) {
        id = 'sc-auth';
      }

      document.querySelectorAll('.sc').forEach((sc) => sc.classList.remove('on'));
      const target = document.getElementById(id);
      if (!target) return;
      target.classList.add('on');
      this.current = id;
      window.scrollTo({ top: 0, behavior: 'instant' });
      window.dispatchEvent(new CustomEvent('screen:enter', { detail: { id, payload } }));
    },
  };

  const KR = (window.KR = window.KR || {});
  KR.Router = Router;
  window.Router = Router;
})();
