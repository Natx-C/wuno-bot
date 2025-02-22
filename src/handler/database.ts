import mongoose from "mongoose";
import type { Logger } from "pino";

export const connectDatabase = (mongoUri: string, logger: Logger) =>
  mongoose
    .connect(mongoUri)
    .then(() => logger.info("[DB] Connected"))
    .catch((error) => {
      logger.error({ error });
      process.exit();
    });
