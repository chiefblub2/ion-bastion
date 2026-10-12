import { defineConfig } from "vite";

// GitHub Pages serves the game below the repository name; CI sets VITE_BASE=/ion-bastion/.
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
});
