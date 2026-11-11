import type { ErrorRequestHandler } from "express";
import pino from "pino";
import { env } from "../config/env";
import { AppError } from "../utils/errors";
import {
  isFirestoreQuotaError,
  quotaError,
  QUOTA_RETRY_SECONDS,
} from "../database/firestore-operation";

export const logger = pino({ level: env.LOG_LEVEL });
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  let e =
    error instanceof AppError
      ? error
      : new AppError(500, "INTERNAL_ERROR", "Có lỗi xảy ra. Vui lòng thử lại.");
  if (error?.type === "entity.parse.failed")
    e = new AppError(400, "INVALID_JSON", "Nội dung yêu cầu không hợp lệ.");
  if (error?.type === "entity.too.large")
    e = new AppError(
      400,
      "BODY_TOO_LARGE",
      "Yêu cầu vượt kích thước cho phép.",
    );
  if ([4, 10, 14].includes(error?.code))
    e = new AppError(
      503,
      "DEPENDENCY_UNAVAILABLE",
      "Cơ sở dữ liệu tạm thời không kết nối được.",
    );
  if (isFirestoreQuotaError(error)) {
    e = quotaError();
    res.setHeader("Retry-After", String(QUOTA_RETRY_SECONDS));
  }
  logger.error(
    {
      requestId: res.locals.requestId,
      code: e.code,
      status: e.status,
      upstreamCode: typeof error?.code === "number" ? error.code : undefined,
    },
    "Request failed",
  );
  res.status(e.status).json({
    error: {
      code: e.code,
      message: e.message,
      fieldErrors: e.fieldErrors,
      requestId: res.locals.requestId,
    },
  });
};
