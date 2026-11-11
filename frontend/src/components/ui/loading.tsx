import { LoaderCircle } from "lucide-react";

export function Loading() {
  return (
    <div className="loading" aria-live="polite">
      <LoaderCircle className="spin" size={22} /> Đang tải dữ liệu…
    </div>
  );
}
