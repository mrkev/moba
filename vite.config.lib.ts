import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

// https://vitejs.dev/config/
export default defineConfig({
  logLevel: "info",
  plugins: [
    react(),
    dts({
      tsconfigPath: "./tsconfig.app.json",
      entryRoot: "src",
      exclude: ["src/site/**"],
    }),
  ],
  build: {
    outDir: "dist",
    minify: false,
    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: resolve(import.meta.dirname, "src/index.ts"),
      name: "NEW_LIB",
      // the proper extensions will be added
      fileName: "NEW_LIB",
    },
    rolldownOptions: {
      // make sure to externalize deps that shouldn't be bundled nto your library
      external: ["react", "react-dom"],
      output: {
        // Provide global variables to use in the UMD build for externalized deps
        globals: {
          react: "React",
          "reactd-dom": "ReactDOM",
        },
      },
    },
  },
});
