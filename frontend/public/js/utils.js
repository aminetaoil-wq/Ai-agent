// Shared helpers — pure functions + the toast controller. Lives under a
// single namespace `KR` so we don't pollute window.
(function () {
  const KR = (window.KR = window.KR || {});

  const STATUS_LABELS = {
    OPEN: 'Open',
    ASSIGNED: 'Toegewezen',
    IN_PROGRESS: 'Bezig',
    COMPLETED: 'Afgerond',
    CANCELLED: 'Geannuleerd',
  };
  const STATUS_BADGE = {
    OPEN: 'bo',
    ASSIGNED: 'bb',
    IN_PROGRESS: 'bb',
    COMPLETED: 'bg',
    CANCELLED: 'bx',
  };

  const escape = (str = '') =>
    String(str).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[m]);

  const fmtMoney = (cents) => (cents == null ? '—' : '€' + (cents / 100).toFixed(2));

  const fmtDate = (d) =>
    new Intl.DateTimeFormat('nl-NL', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(d));

  const initials = (name = '') =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || '?';

  let toastTimer = null;
  function toast(msg, isError = false) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('err', !!isError);
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('on'), 2400);
  }

  function jobCard(job, { showActions = true } = {}) {
    const status = STATUS_LABELS[job.status] || job.status;
    const cls = STATUS_BADGE[job.status] || 'bx';
    return `
      <div class="kc card-hover" data-job-id="${escape(job.id)}">
        <div class="kch flex jb ac g8">
          <span class="badge ${cls}">${escape(status)}</span>
          <span class="xs">${escape(fmtDate(job.createdAt))}</span>
        </div>
        <div class="kcb">
          <h3 class="h4">${escape(job.title)}</h3>
          <p class="sm mt4">${escape(job.category?.name || '')} · ${escape(job.city)}</p>
          <p class="sm mt8">${escape(job.description.slice(0, 120))}${job.description.length > 120 ? '…' : ''}</p>
        </div>
        <div class="kcf">
          <span class="xs">${escape(fmtMoney(job.budgetCents))}</span>
          ${showActions ? '<button class="btn btn-ghost btn-sm">Bekijk →</button>' : ''}
        </div>
      </div>
    `;
  }

  KR.utils = { escape, fmtMoney, fmtDate, initials, toast, jobCard, STATUS_LABELS, STATUS_BADGE };

  // Back-compat: a few callers still reference window.toast directly.
  window.toast = toast;
})();
