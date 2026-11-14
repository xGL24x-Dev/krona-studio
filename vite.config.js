import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Rutas relativas: el build funciona en GitHub Pages (subcarpeta /repo/) sin rutas rotas.
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    target: "es2020",
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react")) return "react";
        },
      },
    },
  },
});
