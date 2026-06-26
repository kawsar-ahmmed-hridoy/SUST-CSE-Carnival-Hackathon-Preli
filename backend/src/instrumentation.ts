/**
 * Next.js instrumentation hook. Runs once on server start.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startupInit } = await import('@/app/init');
  await startupInit();
}
