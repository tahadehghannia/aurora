/**
 * Test-time stand-in for the `server-only` package, wired up in vitest.config.ts.
 *
 * The real package throws when imported from a client bundle. That protection
 * comes from the bundler at build time, so replacing it under Vitest lets
 * server modules be unit-tested without weakening anything in production.
 */
export {};
