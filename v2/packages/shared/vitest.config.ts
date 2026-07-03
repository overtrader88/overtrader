import { defineConfig } from "vitest/config";

export default defineConfig({
  // PostCSS inline vazio: impede o Vite de subir a árvore e carregar o
  // postcss.config.mjs da raiz do repo (v1), que exige tailwind — os testes
  // do package não processam CSS (quebrava em worktrees sem node_modules na raiz).
  css: { postcss: { plugins: [] } },
  test: {
    environment: "node",
  },
});
