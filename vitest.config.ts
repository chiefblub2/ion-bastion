import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Worker threads start far faster than forked processes; the suite is pure computation.
    pool: "threads",
  },
});
