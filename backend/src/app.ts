import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { api } from "./routes/index";
import { env } from "./config/env";
import { authenticate } from "./middleware/authenticate";
import { errorHandler, logger } from "./middleware/error-handler";
import { readiness } from "./database/store";
import { AppError } from "./utils/errors";
import {
  requestUsage,
  recordRequest,
  newUsage,
} from "./observability/firestore-usage";

export const app = express();
app.disable("x-powered-by");
// Business responses must be revalidated through the authenticated API.
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use((req, res, next) => {
  const usage = newUsage();
  res.locals.requestId = randomUUID();
  res.setHeader("X-Request-Id", res.locals.requestId);
  const start = Date.now();
  res.on("finish", () => {
    recordRequest(req.method + " " + (req.route?.path || "unmatched"), usage);
    logger.info(
      {
        requestId: res.locals.requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - start,
        firestore: usage,
      },
      "HTTP",
    );
  });
  requestUsage.run(usage, next);
});
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.CORS_ORIGINS.split(",").includes(origin))
        callback(null, true);
      else
        callback(
          new AppError(403, "ORIGIN_DENIED", "Nguồn truy cập không được phép."),
        );
    },
    exposedHeaders: ["Content-Disposition", "X-Request-Id"],
  }),
);
app.use(express.json({ limit: "64kb" }));
app.use(
  rateLimit({
    windowMs: 60000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(
        new AppError(
          429,
          "RATE_LIMITED",
          "Bạn thao tác quá nhanh. Vui lòng chờ một phút.",
        ),
      ),
  }),
);
app.get("/api/health", (_req, res) =>
  res.json({
    status: "ok",
    process: "alive",
    checkedAt: new Date().toISOString(),
  }),
);
app.get("/api/ready", async (_req, res) => {
  const r = await readiness();
  res.json({ status: r.status, checkedAt: r.checkedAt });
});
app.use("/api/v1", authenticate, api);
app.use((_req, _res, next) =>
  next(new AppError(404, "NOT_FOUND", "Đường dẫn API không tồn tại.")),
);
app.use(errorHandler);
