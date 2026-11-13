import type { ToastMessage } from "./toast-events";

// Describe the recorded outcome, rather than marking every successful HTTP response green.
export function actionToast({
  path,
  body,
}: {
  path: string;
  body?: unknown;
}): ToastMessage {
  const values =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const action = path.match(
    /^\/(?:leave-requests|work-registrations|internal-requests|recruitment\/candidates|professional\/work-items)\/[^/]+\/(reject|cancel|evaluate|return)$/,
  )?.[1];
  if (action === "reject") {
    return {
      tone: "error",
      message: path.startsWith("/recruitment/")
        ? "Đã dừng tuyển dụng ứng viên"
        : "Đã từ chối yêu cầu",
    };
  }
  if (action === "cancel") return { tone: "error", message: "Đã hủy yêu cầu" };
  if (action === "return")
    return { tone: "warning", message: "Đã yêu cầu bổ sung" };
  if (action === "evaluate") {
    if (values.result === "failed")
      return { tone: "error", message: "Đã lưu đánh giá: chưa đạt yêu cầu" };
    if (values.result === "passed")
      return { tone: "success", message: "Đã lưu đánh giá: đạt yêu cầu" };
  }
  if (/^\/(?:users|departments|positions)\/[^/]+\/status$/.test(path)) {
    if (values.active === false)
      return { tone: "error", message: "Đã ngừng sử dụng" };
    if (values.active === true)
      return { tone: "success", message: "Đã kích hoạt" };
  }
  return { tone: "success", message: "Đã lưu thay đổi thành công" };
}
