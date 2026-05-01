// One-shot seed for the demo. Mirrors backend/prisma/seed.ts: 8
// categories, two demo accounts (Demo1234!), and a couple of starter
// jobs so the dashboard is never empty on first visit.
(function () {
  const KR = (window.KR = window.KR || {});

  function seedIfEmpty() {
    const Store = KR.MockStore;
    if (!Store) return;
    if (Store.isSeeded()) return;

    const now = new Date();
    const minutesAgo = (m) => new Date(now.getTime() - m * 60_000).toISOString();

    Store.applySeed(({ addCategory, addUser, addJob, newId }) => {
      const cats = [
        { name: 'Elektra', slug: 'elektra', icon: '⚡' },
        { name: 'Loodgieter', slug: 'loodgieter', icon: '🔧' },
        { name: 'Schilderwerk', slug: 'schilderwerk', icon: '🎨' },
        { name: 'Timmerwerk', slug: 'timmerwerk', icon: '🪚' },
        { name: 'Tegelzetten', slug: 'tegelzetten', icon: '🧱' },
        { name: 'Tuinonderhoud', slug: 'tuinonderhoud', icon: '🌿' },
        { name: 'Verhuizen', slug: 'verhuizen', icon: '🚚' },
        { name: 'Schoonmaak', slug: 'schoonmaak', icon: '🧹' },
      ].map((c) => ({ ...c, id: newId('c_') }));
      cats.forEach(addCategory);

      const client = {
        id: newId('u_'),
        email: 'klant@klusraak.nl',
        passwordHash: 'Demo1234!',
        name: 'Demo Klant',
        phone: '+31 6 12345678',
        role: 'CLIENT',
        avatarUrl: null,
        createdAt: minutesAgo(60 * 24),
        updatedAt: minutesAgo(60 * 24),
      };
      const craftsman = {
        id: newId('u_'),
        email: 'vakman@klusraak.nl',
        passwordHash: 'Demo1234!',
        name: 'Demo Vakman',
        phone: '+31 6 87654321',
        role: 'CRAFTSMAN',
        avatarUrl: null,
        createdAt: minutesAgo(60 * 24),
        updatedAt: minutesAgo(60 * 24),
        craftsmanProfile: {
          id: newId('cp_'),
          userId: '',
          kvkNumber: '12345678',
          bio: 'Allround vakman uit Amsterdam. Snel ter plaatse.',
          hourlyRate: 5500,
          city: 'Amsterdam',
          verified: true,
          categories: [],
          createdAt: minutesAgo(60 * 24),
          updatedAt: minutesAgo(60 * 24),
        },
      };
      craftsman.craftsmanProfile.userId = craftsman.id;
      addUser(client);
      addUser(craftsman);

      const elektra = cats.find((c) => c.slug === 'elektra');
      const loodgieter = cats.find((c) => c.slug === 'loodgieter');

      addJob({
        id: newId('j_'),
        clientId: client.id,
        categoryId: elektra.id,
        title: 'Stopcontact in keuken vervangen',
        description: 'Bestaand stopcontact werkt niet meer; graag vervangen door een geaard exemplaar.',
        city: 'Amsterdam',
        postcode: '1015AB',
        budgetCents: 8500,
        scheduledAt: null,
        status: 'OPEN',
        createdAt: minutesAgo(120),
        updatedAt: minutesAgo(120),
      });
      addJob({
        id: newId('j_'),
        clientId: client.id,
        categoryId: loodgieter.id,
        title: 'Lekkende kraan in badkamer',
        description: 'Mengkraan druppelt al een week. Onderdeel mag vervangen worden.',
        city: 'Utrecht',
        postcode: null,
        budgetCents: 6000,
        scheduledAt: null,
        status: 'OPEN',
        createdAt: minutesAgo(45),
        updatedAt: minutesAgo(45),
      });
    });
  }

  KR.MockSeed = { seedIfEmpty };
})();
