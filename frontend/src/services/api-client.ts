import { auth, env } from "../config/firebase";
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code = "NETWORK_ERROR",
    public fieldErrors: Record<string, string[]> = {},
    public requestId = "",
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    key?: string;
    signal?: AbortSignal;
    download?: boolean;
    file?: File;
    version?: number;
  } = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort);
  if (options.signal?.aborted) controller.abort();
  try {
    const token = await auth.currentUser?.getIdToken();
    controller.signal.throwIfAborted();
    const response = await fetch(env.VITE_API_BASE_URL + path, {
      method: options.method || "GET",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.file
          ? {
              "Content-Type": "application/pdf",
              "X-File-Name": encodeURIComponent(options.file.name),
              "X-Record-Version": String(options.version),
            }
          : {}),
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.key ? { "Idempotency-Key": options.key } : {}),
      },
      body:
        options.file ??
        (options.body !== undefined ? JSON.stringify(options.body) : undefined),
      signal: controller.signal,
    });
    if (!response.ok) {
      let data: {
        error?: {
          message?: string;
          code?: string;
          fieldErrors?: Record<string, string[]>;
          requestId?: string;
        };
      } = {};
      try {
        data = await response.json();
      } catch {
        /* Proxy failures need a useful fallback. */
      }
      throw new ApiError(
        data.error?.message ||
          (response.status === 503
            ? "Cơ sở dữ liệu tạm thời không kết nối được."
            : "Không nhận được phản hồi hợp lệ từ máy chủ."),
        response.status,
        data.error?.code || "API_ERROR",
        data.error?.fieldErrors,
        data.error?.requestId,
      );
    }
    if (options.download) return (await response.blob()) as T;
    try {
      return (await response.json()) as T;
    } catch {
      throw new ApiError(
        "Máy chủ trả về nội dung không hợp lệ. Kiểm tra kết nối API.",
        502,
        "INVALID_RESPONSE",
      );
    }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(
      controller.signal.aborted
        ? "Yêu cầu hết thời gian chờ. Vui lòng thử lại."
        : navigator.onLine
          ? "Không kết nối được máy chủ. Dữ liệu nhập vẫn được giữ lại."
          : "Bạn đang ngoại tuyến. Hãy kiểm tra kết nối.",
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
export function queryString(values: Record<string, unknown>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(values))
    if (v !== undefined && v !== "" && v !== null) p.set(k, String(v));
  const s = p.toString();
  return s ? "?" + s : "";
}
