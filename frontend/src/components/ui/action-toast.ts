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
  if (path.startsWith("/chat/rooms/") && path.endsWith("/lifecycle")) {
    const messages: Record<string, string> = {
      archive: "Đã lưu trữ nhóm",
      restore: "Đã đưa nhóm về hộp thư",
      leave: "Đã rời nhóm",
      dissolve: "Đã giải tán nhóm",
      hide: "Đã xóa nhóm khỏi hộp thư",
    };
    return {
      tone:
        values.action === "dissolve" || values.action === "hide"
          ? "warning"
          : "success",
      message: messages[String(values.action)] ?? "Đã lưu thay đổi thành công",
    };
  }
  if (path.startsWith("/compensation/")) {
    if (path.endsWith("/cancel"))
      return { tone: "error", message: "Đã hủy điều chỉnh lương" };
    if (path.endsWith("/publish"))
      return { tone: "success", message: "Đã công bố mức lương" };
    return { tone: "success", message: "Đã lưu bản nháp" };
  }
  if (path.startsWith("/performance/")) {
    if (path.endsWith("/cancel"))
      return { tone: "error", message: "Đã hủy kỳ đánh giá" };
    if (path.endsWith("/return") || /\/return_(self|manager)$/.test(path))
      return { tone: "warning", message: "Đã yêu cầu bổ sung" };
    if (values.submit === false)
      return { tone: "success", message: "Đã lưu bản nháp" };
  }
  if (path.startsWith("/employment/")) {
    if (path.endsWith("/decline"))
      return { tone: "error", message: "Đã ghi nhận kết quả không đạt" };
    if (path.endsWith("/cancel"))
      return { tone: "error", message: "Đã hủy hợp đồng" };
    if (path.endsWith("/end"))
      return { tone: "warning", message: "Đã kết thúc hợp đồng" };
    if (path.endsWith("/return"))
      return { tone: "warning", message: "Đã yêu cầu bổ sung" };
  }
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
