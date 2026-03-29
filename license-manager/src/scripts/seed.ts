/**
 * Run with: npm run seed
 * Creates a sample product and one test license.
 */
import dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../config/prisma';
import { generateLicenseKey } from '../services/crypto';

async function main() {
  // Create product
  const product = await prisma.product.upsert({
    where: { slug: 'my-desktop-app' },
    update: {},
    create: {
      slug: 'my-desktop-app',
      name: 'My Desktop App',
      defaultMaxMachines: 2,
      defaultTrialDays: 14,
      features: JSON.stringify(['feature-a', 'feature-b']),
    },
  });
  console.log('✅ Product:', product.slug);

  // Create a perpetual license
  const license = await prisma.license.create({
    data: {
      key: generateLicenseKey(),
      productId: product.id,
      maxMachines: 2,
      entitlements: JSON.stringify(['pro', 'feature-a', 'feature-b']),
      metadata: JSON.stringify({ customer: 'test@example.com' }),
    },
  });
  console.log('✅ License key:', license.key);
  console.log('\nUse this key to test the /activate endpoint.\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
