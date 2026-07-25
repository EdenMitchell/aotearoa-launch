import { defineConfig } from "vite";

export default defineConfig({
  // The production site lives at EdenMitchell.github.io/aotearoa-launch/.
  // Keep local development at the domain root for the existing npm workflow.
  base: process.env.GITHUB_ACTIONS ? "/aotearoa-launch/" : "/",
});
