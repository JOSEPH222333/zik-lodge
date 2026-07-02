import { defineConfig } from "vitest/config";

// Server tests run in Node and load deterministic environment values from tests/setup.ts.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"]
  }
});
