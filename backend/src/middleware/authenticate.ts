import type { RequestHandler } from "express";
import { auth } from "../config/firebase-admin";
import { AppError } from "../utils/errors";
import { timeout } from "../database/store";

export const authenticate: RequestHandler = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer "))
      throw new AppError(
        401,
        "UNAUTHENTICATED",
        "Vui lòng đăng nhập để tiếp tục.",
      );
    try {
      const decoded = await timeout(auth.verifyIdToken(header.slice(7)), 5000);
      res.locals.uid = decoded.uid;
      res.locals.tokenExpiresAt = decoded.exp * 1000;
    } catch (e) {
      if (e instanceof AppError) throw e;
      const code = (e as { code?: string }).code || "";
      if (["auth/internal-error", "app/network-error"].includes(code))
        throw new AppError(
          503,
          "AUTH_UNAVAILABLE",
          "Dịch vụ xác thực tạm thời không kết nối được.",
        );
      throw new AppError(
        401,
        "INVALID_TOKEN",
        "Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.",
      );
    }
    next();
  } catch (e) {
    next(e);
  }
};
