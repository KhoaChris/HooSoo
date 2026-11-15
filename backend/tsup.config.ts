import { defineConfig } from "tsup";
import { cp } from "node:fs/promises";
export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  noExternal: ["@hoosoo/shared"],
  clean: true,
  async onSuccess() {
    await cp(
      new URL("./public/api-explorer/", import.meta.url),
      new URL("./dist/public/api-explorer/", import.meta.url),
      { recursive: true },
    );
  },
});
