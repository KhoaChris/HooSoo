import { env } from "../../config/env";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Router, static as serveStatic } from "express";
import { createCatalog, type RouteGroup } from "./catalog";

export function createApiExplorer(groups: RouteGroup[]) {
  const router = Router();
  const catalog = createCatalog(groups);
  // tsx runs from src/modules; tsup bundles into dist/server.js.
  const bundled = new URL("./public/api-explorer/", import.meta.url);
  const assets = fileURLToPath(
    existsSync(bundled)
      ? bundled
      : new URL("../../../public/api-explorer/", import.meta.url),
  );
  router.get("/", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    // Local HTTP development must work in browsers that enforce CSP upgrades.
    const csp = String(res.getHeader("Content-Security-Policy") ?? "");
    if (csp && env.NODE_ENV !== "production")
      res.setHeader(
        "Content-Security-Policy",
        csp.replace(/(?:^|;)upgrade-insecure-requests(?:;|$)/, ";"),
      );
    res.sendFile("index.html", { root: assets });
  });
  router.get("/api-explorer/catalog.json", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json(catalog);
  });
  router.use(
    "/api-explorer",
    serveStatic(assets, { index: false, maxAge: 0, dotfiles: "deny" }),
  );
  return router;
}
