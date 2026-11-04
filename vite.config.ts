import { defineConfig } from "vite";

// GitHub Pages serves the game below the repository name; CI sets VITE_BASE=/ion-bastion/.
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  build: {
    rolldownOptions: {
      // Phaser changes far less often than the game, so it gets its own long-lived cached chunk.
      output: { codeSplitting: { groups: [{ name: "phaser", test: /[\\/]node_modules[\\/]phaser[\\/]/ }] } },
    },
  },
});
