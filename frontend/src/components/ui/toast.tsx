import { t, useLocale } from "../../i18n";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleX, TriangleAlert, X } from "lucide-react";
import type { ToastMessage } from "./toast-events";

export function Toast() {
  useLocale();
  const [visible, setVisible] = useState(false);
  const [toast, setToast] = useState<ToastMessage>({
    message: "Đã lưu thay đổi thành công",
    tone: "success",
  });
  const currentTone = useRef<ToastMessage["tone"]>("success");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const show = (value: ToastMessage) => {
      currentTone.current = value.tone;
      setToast(value);
      setVisible(true);
      clearTimeout(timer);
      timer = setTimeout(
        () => setVisible(false),
        value.tone === "error" ? 6000 : value.tone === "warning" ? 5000 : 3500,
      );
    };
    const saved = () =>
      show({ message: "Đã lưu thay đổi thành công", tone: "success" });
    const notify = (event: Event) =>
      show((event as CustomEvent<ToastMessage>).detail);
    const dismissWarning = () => {
      if (currentTone.current !== "warning") return;
      clearTimeout(timer);
      setVisible(false);
    };
    window.addEventListener("hoosoo:saved", saved);
    window.addEventListener("hoosoo:toast", notify);
    window.addEventListener("hoosoo:toast-dismiss-warning", dismissWarning);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("hoosoo:saved", saved);
      window.removeEventListener("hoosoo:toast", notify);
      window.removeEventListener(
        "hoosoo:toast-dismiss-warning",
        dismissWarning,
      );
    };
  }, []);
  return (
    <div
      className={`toast status-tone toast-${toast.tone} ${visible ? "visible" : ""}`}
      data-tone={toast.tone === "error" ? "danger" : toast.tone}
      role={toast.tone === "success" ? "status" : "alert"}
      aria-atomic="true"
    >
      {visible && (
        <>
          {toast.tone === "error" ? (
            <CircleX size={19} aria-hidden="true" />
          ) : toast.tone === "warning" ? (
            <TriangleAlert size={19} aria-hidden="true" />
          ) : (
            <CheckCircle2 size={19} aria-hidden="true" />
          )}
          <span>{t(toast.message)}</span>
          <button
            type="button"
            className="toast-close"
            aria-label={t("Đóng thông báo")}
            onClick={() => setVisible(false)}
          >
            <X size={16} />
          </button>
        </>
      )}
    </div>
  );
}
