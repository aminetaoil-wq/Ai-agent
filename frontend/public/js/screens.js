// Per-screen render + form handlers. Pure orchestration — all DOM helpers
// live in utils.js. Side-effects (polling) are tracked so we can clean up
// when the user navigates away or backgrounds the tab.
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const { escape, fmtMoney, fmtDate, initials, toast, jobCard, STATUS_LABELS, STATUS_BADGE } = window.KR.utils;

  /* -------------------- AUTH -------------------- */

  let currentRole = 'CLIENT';

  function bindAuth() {
    $$('.rtab').forEach((t) =>
      t.addEventListener('click', () => {
        $$('.rtab').forEach((x) => x.classList.remove('on'));
        t.classList.add('on');
        const isLogin = t.dataset.tab === 'login';
        $('#form-login').hidden = !isLogin;
        $('#form-register').hidden = isLogin;
      }),
    );

    $$('.oc[data-role]').forEach((card) =>
      card.addEventListener('click', () => {
        $$('.oc[data-role]').forEach((c) => c.classList.remove('sel'));
        card.classList.add('sel');
        currentRole = card.dataset.role;
        $('input[name="role"]', $('#form-register')).value = currentRole;
      }),
    );
    $('.oc[data-role="CLIENT"]').classList.add('sel');

    $$('[data-toggle-pw]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const input = btn.parentElement.querySelector('input');
        input.type = input.type === 'password' ? 'text' : 'password';
      }),
    );

    $('#form-login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        const data = await window.API.login({
          email: fd.get('email'),
          password: fd.get('password'),
        });
        window.Store.setSession(data);
        toast('Welkom terug, ' + data.user.name);
        window.Router.go('sc-dash');
      } catch (err) {
        toast(err.message || 'Inloggen mislukt', true);
      }
    });

    $('#form-register').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        const data = await window.API.register({
          email: fd.get('email'),
          password: fd.get('password'),
          name: fd.get('name'),
          phone: fd.get('phone') || undefined,
          role: fd.get('role'),
        });
        window.Store.setSession(data);
        toast('Account aangemaakt');
        window.Router.go('sc-dash');
      } catch (err) {
        toast(err.message || 'Registreren mislukt', true);
      }
    });
  }

  /* -------------------- DASHBOARD -------------------- */

  async function renderDashboard() {
    const body = $('#dash-body');
    const user = window.Store.user;
    if (!user) return;

    body.innerHTML = `
      <div class="hbg" style="padding:24px;border-radius:var(--r);">
        <div style="position:relative;z-index:1;">
          <div class="badge bo">${user.role === 'CLIENT' ? 'Klant' : 'Vakman'}</div>
          <h2 class="h2 mt8">Hoi ${escape(user.name.split(' ')[0])} 👋</h2>
          <p class="sm mt8">${
            user.role === 'CLIENT'
              ? 'Klaar om een klus uit te zetten?'
              : 'Bekijk welke klussen vandaag op je wachten.'
          }</p>
          <div class="flex g10 mt16">
            ${
              user.role === 'CLIENT'
                ? '<button class="btn btn-primary" data-go="sc-new">+ Nieuwe klus</button>'
                : '<button class="btn btn-primary" data-go="sc-jobs">Open klussen</button>'
            }
          </div>
        </div>
      </div>

      <div class="sec-label mt24">Recent</div>
      <div class="flex fc g12" id="dash-recent"><p class="sm">Laden…</p></div>
    `;

    try {
      const { jobs } = await window.API.listMyJobs();
      const recent = jobs.slice(0, 5);
      const list = $('#dash-recent');
      list.innerHTML = recent.length === 0
        ? '<div class="empty">Nog geen klussen.</div>'
        : recent.map((j) => jobCard(j)).join('');
    } catch (err) {
      $('#dash-recent').innerHTML = `<p class="sm">${escape(err.message)}</p>`;
    }
  }

  /* -------------------- JOBS LIST -------------------- */

  let activeCategory = null;

  async function renderJobs() {
    const isCraftsman = window.Store.isCraftsman();
    $('#jobs-title').textContent = isCraftsman ? 'Open klussen' : 'Mijn klussen';

    const chips = $('#jobs-chips');
    if (isCraftsman) {
      const cats = window.Store.categories;
      chips.innerHTML =
        '<button class="chip ' + (activeCategory == null ? 'on' : '') + '" data-cat="">Alle</button>' +
        cats
          .map(
            (c) =>
              `<button class="chip ${activeCategory === c.id ? 'on' : ''}" data-cat="${escape(c.id)}">${escape(
                c.icon || '',
              )} ${escape(c.name)}</button>`,
          )
          .join('');
      $$('.chip', chips).forEach((chip) =>
        chip.addEventListener('click', () => {
          activeCategory = chip.dataset.cat || null;
          renderJobs();
        }),
      );
    } else {
      chips.innerHTML = '';
    }

    const list = $('#jobs-list');
    list.innerHTML = '<p class="sm">Laden…</p>';
    try {
      const data = isCraftsman
        ? await window.API.listOpenJobs({ categoryId: activeCategory || undefined })
        : await window.API.listMyJobs();
      const jobs = isCraftsman ? data.items : data.jobs;
      if (!jobs || jobs.length === 0) {
        list.innerHTML =
          '<div class="empty">' +
          (isCraftsman ? 'Geen open klussen op dit moment.' : 'Nog geen klussen geplaatst.') +
          '</div>';
        return;
      }
      list.innerHTML = jobs.map((j) => jobCard(j)).join('');
    } catch (err) {
      list.innerHTML = `<p class="sm">${escape(err.message)}</p>`;
    }
  }

  /* -------------------- NEW JOB -------------------- */

  async function renderNewJob() {
    const sel = $('select[name="categoryId"]', $('#form-new-job'));
    if (window.Store.categories.length === 0) {
      try {
        const { categories } = await window.API.listCategories();
        window.Store.categories = categories;
      } catch (_) { /* offline ok */ }
    }
    sel.innerHTML = window.Store.categories
      .map((c) => `<option value="${escape(c.id)}">${escape(c.icon || '')} ${escape(c.name)}</option>`)
      .join('');
  }

  function bindNewJob() {
    $('#form-new-job').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const budgetEuro = fd.get('budgetEuro');
      const payload = {
        categoryId: fd.get('categoryId'),
        title: fd.get('title'),
        description: fd.get('description'),
        city: fd.get('city'),
        postcode: fd.get('postcode') || undefined,
        budgetCents: budgetEuro ? Math.round(Number(budgetEuro) * 100) : undefined,
      };
      try {
        const { job } = await window.API.createJob(payload);
        toast('Klus geplaatst');
        e.target.reset();
        window.Store.currentJobId = job.id;
        window.Router.go('sc-job');
      } catch (err) {
        toast(err.message || 'Plaatsen mislukt', true);
      }
    });
  }

  /* -------------------- JOB DETAIL -------------------- */

  async function renderJob() {
    const id = window.Store.currentJobId;
    const body = $('#job-body');
    if (!id) {
      body.innerHTML = '<div class="empty">Geen klus geselecteerd.</div>';
      return;
    }
    body.innerHTML = '<p class="sm">Laden…</p>';
    try {
      const { job } = await window.API.getJob(id);
      const isClient = window.Store.user?.id === job.clientId;
      const isAssignedCraftsman = job.assignment?.craftsmanId === window.Store.user?.id;
      const status = STATUS_LABELS[job.status] || job.status;
      const cls = STATUS_BADGE[job.status] || 'bx';

      const actions = [];
      if (job.status === 'OPEN' && window.Store.isCraftsman()) {
        actions.push('<button class="btn btn-primary btn-full" data-act="accept">Klus accepteren</button>');
      }
      if (job.status === 'ASSIGNED' && isAssignedCraftsman) {
        actions.push('<button class="btn btn-primary btn-full" data-act="start">Start klus</button>');
      }
      if (job.status === 'IN_PROGRESS' && isAssignedCraftsman) {
        actions.push('<button class="btn btn-success btn-full" data-act="complete">Markeer afgerond</button>');
      }
      if (isClient && (job.status === 'OPEN' || job.status === 'ASSIGNED' || job.status === 'IN_PROGRESS')) {
        actions.push('<button class="btn btn-danger btn-full" data-act="cancel">Annuleer klus</button>');
      }
      if (job.assignment && (isClient || isAssignedCraftsman)) {
        actions.unshift('<button class="btn btn-secondary btn-full" data-act="chat">💬 Chat openen</button>');
      }
      if (job.status === 'COMPLETED' && (isClient || isAssignedCraftsman)) {
        actions.push(`
          <form class="card mt8" id="form-review">
            <div class="h4">Beoordeel je ${isClient ? 'vakman' : 'klant'}</div>
            <div class="fg mt8">
              <label>Score (1–5)</label>
              <input type="number" name="rating" min="1" max="5" required value="5" />
            </div>
            <div class="fg mt8">
              <label>Opmerking</label>
              <textarea name="comment" rows="2" placeholder="Optioneel"></textarea>
            </div>
            <button class="btn btn-primary btn-full mt12" type="submit">Verstuur beoordeling</button>
          </form>
        `);
      }

      body.innerHTML = `
        <div class="flex jb ac">
          <span class="badge ${cls}">${escape(status)}</span>
          <span class="xs">${escape(fmtDate(job.createdAt))}</span>
        </div>
        <h2 class="h2 mt12">${escape(job.title)}</h2>
        <p class="sm mt4">${escape(job.category?.name || '')} · ${escape(job.city)}</p>
        <div class="card mt16">
          <div class="h4">Beschrijving</div>
          <p class="sm mt8" style="white-space:pre-wrap;">${escape(job.description)}</p>
        </div>
        <div class="card mt12">
          <div class="flex jb ac">
            <span class="sm">Budget</span>
            <span class="h4">${escape(fmtMoney(job.budgetCents))}</span>
          </div>
        </div>
        ${
          job.assignment
            ? `<div class="card mt12">
                <div class="sec-label">Toegewezen aan</div>
                <div class="flex ac g12 mt4">
                  <div class="av">${escape(initials(job.assignment.craftsman?.name))}</div>
                  <div>
                    <div class="h4">${escape(job.assignment.craftsman?.name || '')}</div>
                    <div class="xs">Geaccepteerd ${escape(fmtDate(job.assignment.acceptedAt))}</div>
                  </div>
                </div>
              </div>`
            : ''
        }
        <div class="flex fc g8 mt16">${actions.join('')}</div>
      `;

      body.querySelectorAll('[data-act]').forEach((btn) =>
        btn.addEventListener('click', async () => {
          const act = btn.dataset.act;
          try {
            if (act === 'chat') return window.Router.go('sc-chat');
            if (act === 'accept') await window.API.acceptJob(id);
            if (act === 'start') await window.API.startJob(id);
            if (act === 'complete') await window.API.completeJob(id);
            if (act === 'cancel') {
              if (!confirm('Weet je zeker dat je deze klus wilt annuleren?')) return;
              await window.API.cancelJob(id);
            }
            toast('Bijgewerkt');
            renderJob();
          } catch (err) {
            toast(err.message || 'Actie mislukt', true);
          }
        }),
      );

      const reviewForm = body.querySelector('#form-review');
      if (reviewForm) {
        reviewForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          try {
            await window.API.createReview(id, {
              rating: Number(fd.get('rating')),
              comment: fd.get('comment') || undefined,
            });
            toast('Beoordeling verstuurd');
            renderJob();
          } catch (err) {
            toast(err.message || 'Mislukt', true);
          }
        });
      }
    } catch (err) {
      body.innerHTML = `<div class="empty">${escape(err.message)}</div>`;
    }
  }

  /* -------------------- CHAT --------------------
   * Polling lifecycle: started on screen entry, stopped on screen leave AND
   * when the tab is backgrounded. We resume on visibility return.
   */
  const POLL_MS = 4000;
  let chatPoll = null;
  let chatRefresh = null;

  function startChatPolling() {
    if (chatPoll || !chatRefresh) return;
    chatPoll = setInterval(chatRefresh, POLL_MS);
  }
  function stopChatPolling() {
    if (chatPoll) {
      clearInterval(chatPoll);
      chatPoll = null;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (window.Router.current !== 'sc-chat') return;
    if (document.hidden) stopChatPolling();
    else startChatPolling();
  });

  async function renderChat() {
    const id = window.Store.currentJobId;
    const thread = $('#chat-thread');
    if (!id) {
      thread.innerHTML = '<div class="empty">Geen klus geselecteerd.</div>';
      return;
    }

    chatRefresh = async function refresh() {
      try {
        const { messages } = await window.API.listMessages(id);
        thread.innerHTML = messages
          .map((m) => {
            const mine = m.senderId === window.Store.user?.id;
            return `
              <div class="flex ${mine ? 'jc' : ''}" style="${mine ? 'justify-content:flex-end;' : ''}">
                <div class="chat-bubble ${mine ? 'cb-out' : 'cb-in'}">
                  ${!mine ? `<div class="xs" style="margin-bottom:2px;color:#999;">${escape(m.sender?.name || '')}</div>` : ''}
                  ${escape(m.content)}
                </div>
              </div>`;
          })
          .join('');
        thread.scrollTop = thread.scrollHeight;
      } catch (err) {
        thread.innerHTML = `<div class="empty">${escape(err.message)}</div>`;
      }
    };

    await chatRefresh();
    stopChatPolling();
    startChatPolling();

    $('#chat-form').onsubmit = async (e) => {
      e.preventDefault();
      const input = e.target.querySelector('input[name="content"]');
      const content = input.value.trim();
      if (!content) return;
      input.value = '';
      try {
        await window.API.sendMessage(id, content);
        await chatRefresh();
      } catch (err) {
        toast(err.message || 'Versturen mislukt', true);
      }
    };
  }

  function leaveChat() {
    stopChatPolling();
    chatRefresh = null;
  }

  /* -------------------- PROFILE -------------------- */

  async function renderProfile() {
    const body = $('#profile-body');
    const u = window.Store.user;
    if (!u) return;

    // Pull a fresh profile so we can pre-fill the craftsman form. The
    // earlier version rendered empty inputs even when the user already had
    // data on file.
    let profile = null;
    if (u.role === 'CRAFTSMAN') {
      try {
        const { user } = await window.API.me();
        window.Store.setUser(user);
        profile = user.craftsmanProfile || null;
      } catch (_) { /* keep going */ }
    }

    body.innerHTML = `
      <div class="flex ac g12">
        <div class="av" style="width:54px;height:54px;font-size:18px;">${escape(initials(u.name))}</div>
        <div>
          <div class="h3">${escape(u.name)}</div>
          <div class="xs">${escape(u.email)}</div>
        </div>
      </div>

      <form class="card mt16" id="form-me">
        <div class="sec-label">Account</div>
        <div class="fg mt8">
          <label>Naam</label>
          <input type="text" name="name" value="${escape(u.name)}" />
        </div>
        <div class="fg mt8">
          <label>Telefoon</label>
          <input type="tel" name="phone" value="${escape(u.phone || '')}" />
        </div>
        <button class="btn btn-primary btn-full mt12" type="submit">Opslaan</button>
      </form>

      ${
        u.role === 'CRAFTSMAN'
          ? `<form class="card mt12" id="form-craftsman">
              <div class="sec-label">Vakman-profiel</div>
              <div class="fg mt8">
                <label>KvK</label>
                <input type="text" name="kvkNumber" value="${escape(profile?.kvkNumber || '')}" />
              </div>
              <div class="fg mt8">
                <label>Stad</label>
                <input type="text" name="city" value="${escape(profile?.city || '')}" />
              </div>
              <div class="fg mt8">
                <label>Uurtarief (€)</label>
                <input type="number" name="hourlyRateEuro" min="0" step="1" value="${
                  profile?.hourlyRate != null ? (profile.hourlyRate / 100).toFixed(0) : ''
                }" />
              </div>
              <div class="fg mt8">
                <label>Bio</label>
                <textarea name="bio" rows="3" placeholder="Vertel iets over jezelf">${escape(profile?.bio || '')}</textarea>
              </div>
              <button class="btn btn-primary btn-full mt12" type="submit">Profiel bijwerken</button>
            </form>`
          : ''
      }

      <button class="btn btn-danger btn-full mt16" data-action="logout">Uitloggen</button>
    `;

    $('#form-me').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        const { user } = await window.API.updateMe({
          name: fd.get('name') || undefined,
          phone: fd.get('phone') || undefined,
        });
        window.Store.setUser({ ...window.Store.user, ...user });
        toast('Opgeslagen');
      } catch (err) {
        toast(err.message || 'Opslaan mislukt', true);
      }
    });

    const cf = $('#form-craftsman');
    if (cf) {
      cf.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const hourly = fd.get('hourlyRateEuro');
        try {
          await window.API.updateCraftsman({
            kvkNumber: fd.get('kvkNumber') || undefined,
            city: fd.get('city') || undefined,
            hourlyRate: hourly ? Math.round(Number(hourly) * 100) : undefined,
            bio: fd.get('bio') || undefined,
          });
          toast('Profiel bijgewerkt');
        } catch (err) {
          toast(err.message || 'Mislukt', true);
        }
      });
    }
  }

  /* -------------------- DELEGATION -------------------- */

  // Job-card clicks → open detail.
  document.addEventListener('click', (e) => {
    const card = e.target.closest('[data-job-id]');
    if (card) {
      window.Store.currentJobId = card.dataset.jobId;
      window.Router.go('sc-job');
    }
  });

  // Per-screen entry hooks. Centralised so adding a new screen is a single
  // map entry instead of a new branch in an if/else chain.
  const ENTER_HOOKS = {
    'sc-dash': renderDashboard,
    'sc-jobs': renderJobs,
    'sc-new': renderNewJob,
    'sc-job': renderJob,
    'sc-chat': renderChat,
    'sc-profile': renderProfile,
  };

  window.addEventListener('screen:enter', (e) => {
    const id = e.detail.id;
    if (id !== 'sc-chat') leaveChat();
    const hook = ENTER_HOOKS[id];
    if (hook) hook();
  });

  document.addEventListener('DOMContentLoaded', () => {
    bindAuth();
    bindNewJob();
  });
})();
