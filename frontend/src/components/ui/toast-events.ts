export type ToastMessage = {
  message: string;
  tone: "success" | "error" | "warning";
};

export function showToast(
  message: string,
  tone: ToastMessage["tone"] = "success",
) {
  window.dispatchEvent(
    new CustomEvent<ToastMessage>("hoosoo:toast", {
      detail: { message, tone },
    }),
  );
}

export function dismissWarningToast() {
  window.dispatchEvent(new Event("hoosoo:toast-dismiss-warning"));
}
