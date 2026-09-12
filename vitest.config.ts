import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // `server-only` throws by design outside a React Server Component build.
      // Stubbing it lets server modules be unit-tested directly; it does not
      // weaken the guarantee, which is enforced by the bundler at build time.
      "server-only": new URL("./src/test/server-only-stub.ts", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
