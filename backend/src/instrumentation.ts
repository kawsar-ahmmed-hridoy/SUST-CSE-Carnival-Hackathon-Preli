/**
 * Next.js instrumentation hook. Runs once on server start.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * NOTE: We deliberately use a RELATIVE import here rather than the `@/` alias.
 * Next.js's webpack bundler has a known limitation where dynamic imports of
 * `@/...` paths in the instrumentation file fail with "Module not found" in
 * production builds. Relative paths always resolve correctly.
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startupInit } = await import('./app/init');
  await startupInit();
}