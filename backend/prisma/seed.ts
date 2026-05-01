import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const CATEGORIES = [
  { name: 'Elektra', slug: 'elektra', icon: '⚡' },
  { name: 'Loodgieter', slug: 'loodgieter', icon: '🚿' },
  { name: 'Schilderwerk', slug: 'schilderwerk', icon: '🎨' },
  { name: 'Timmerwerk', slug: 'timmerwerk', icon: '🪚' },
  { name: 'Tegelzetten', slug: 'tegelzetten', icon: '🧱' },
  { name: 'Tuinonderhoud', slug: 'tuinonderhoud', icon: '🌿' },
  { name: 'Verhuizen', slug: 'verhuizen', icon: '📦' },
  { name: 'Schoonmaak', slug: 'schoonmaak', icon: '🧹' },
];

async function main() {
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, icon: c.icon },
      create: c,
    });
  }

  const passwordHash = await bcrypt.hash('Demo1234!', 10);

  const client = await prisma.user.upsert({
    where: { email: 'klant@klusraak.nl' },
    update: {},
    create: {
      email: 'klant@klusraak.nl',
      passwordHash,
      name: 'Demo Klant',
      role: Role.CLIENT,
      phone: '+31 6 12345678',
    },
  });

  const craftsman = await prisma.user.upsert({
    where: { email: 'vakman@klusraak.nl' },
    update: {},
    create: {
      email: 'vakman@klusraak.nl',
      passwordHash,
      name: 'Demo Vakman',
      role: Role.CRAFTSMAN,
      phone: '+31 6 87654321',
      craftsmanProfile: {
        create: {
          kvkNumber: '12345678',
          bio: 'Allround vakman met 12 jaar ervaring in renovaties.',
          hourlyRate: 4500,
          city: 'Amsterdam',
          verified: true,
        },
      },
    },
    include: { craftsmanProfile: true },
  });

  const elektra = await prisma.category.findUnique({ where: { slug: 'elektra' } });
  const loodgieter = await prisma.category.findUnique({ where: { slug: 'loodgieter' } });

  if (craftsman.craftsmanProfile && elektra && loodgieter) {
    await prisma.categoryOnCraftsman.createMany({
      data: [
        { craftsmanId: craftsman.craftsmanProfile.id, categoryId: elektra.id },
        { craftsmanId: craftsman.craftsmanProfile.id, categoryId: loodgieter.id },
      ],
      skipDuplicates: true,
    });
  }

  if (elektra) {
    await prisma.job.upsert({
      where: { id: 'seed-job-1' },
      update: {},
      create: {
        id: 'seed-job-1',
        clientId: client.id,
        categoryId: elektra.id,
        title: 'Stopcontact vervangen in keuken',
        description: 'Bestaand stopcontact werkt niet meer. Graag vandaag of morgen.',
        city: 'Amsterdam',
        postcode: '1011AB',
        budgetCents: 7500,
      },
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
