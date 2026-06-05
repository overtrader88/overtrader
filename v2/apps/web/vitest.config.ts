import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Resolve o alias "@/..." (igual ao tsconfig) também nos testes.
  resolve: { alias: { "@": dir } },
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
