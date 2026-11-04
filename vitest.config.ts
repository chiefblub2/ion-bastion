import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Worker threads start far faster than forked processes; the suite is pure computation.
    pool: "threads",
    // Test files share a worker's module graph, about 3× faster than isolating each file. So tests never mutate
    // shared module state (content packs, registries) and never stub globals without restoring them.
    isolate: false,
  },
});
