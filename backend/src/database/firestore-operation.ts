import { AppError } from "../utils/errors";

export const QUOTA_RETRY_SECONDS = 60;
let quotaRetryAt = 0;

export function isFirestoreQuotaError(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  return (
    code === 8 ||
    code === "resource-exhausted" ||
    code === "FIRESTORE_QUOTA_EXCEEDED"
  );
}

export function quotaError() {
  return new AppError(
    503,
    "FIRESTORE_QUOTA_EXCEEDED",
    "Firestore đã hết hạn mức sử dụng. Tạm thời không thể đọc hoặc lưu dữ liệu mới. Vui lòng chờ hạn mức được khôi phục hoặc liên hệ quản trị viên.",
  );
}

export function recordFirestoreFailure(error: unknown) {
  if (!isFirestoreQuotaError(error)) return error;
  quotaRetryAt = Date.now() + QUOTA_RETRY_SECONDS * 1000;
  return quotaError();
}

// A quota failure is shared by the whole project. Avoid a retry storm from
// multiple tabs, queries and live streams; never substitute local business data.
export async function firestoreOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  if (Date.now() < quotaRetryAt) throw quotaError();
  try {
    return await operation();
  } catch (error) {
    throw recordFirestoreFailure(error);
  }
}
