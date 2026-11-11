import { Inbox } from "lucide-react";

export function Empty({ filtered = false }: { filtered?: boolean }) {
  return (
    <div className="empty">
      <Inbox size={30} />
      <strong>
        {filtered ? "Không có kết quả phù hợp" : "Chưa có dữ liệu"}
      </strong>
      <p>
        {filtered
          ? "Thử thay đổi hoặc bỏ bớt bộ lọc."
          : "Các thông tin mới sẽ xuất hiện tại đây."}
      </p>
    </div>
  );
}
