import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./middleware/error-handler";
import { closeEventStreams } from "./modules/events/events.routes";

const server = app.listen(env.PORT, env.HOST, () =>
  logger.info(
    { host: env.HOST, port: env.PORT, mode: env.FIREBASE_MODE },
    "HooSoo API ready to accept requests",
  ),
);
server.on("error", (error) => {
  logger.error(
    { code: (error as NodeJS.ErrnoException).code },
    "Cannot bind API port",
  );
  process.exitCode = 1;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close(() => process.exit(0));
    closeEventStreams();
  });
