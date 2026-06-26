/**
 * One-shot index setup script. Run with `npm run db:setup`.
 */

import { ensureIndexes } from '@/database/indexes';
import { connectMongo, disconnectMongo } from '@/lib/mongodb';

async function main(): Promise<void> {
  await connectMongo();
  await ensureIndexes();
  await disconnectMongo();
  // eslint-disable-next-line no-console
  console.log('Indexes created successfully.');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to set up indexes:', err);
  process.exit(1);
});
