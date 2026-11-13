import { StableText } from "../../i18n/stable-text";
import { t, useLocale } from "../../i18n";
import { Inbox } from "lucide-react";

export function Empty({ filtered = false }: { filtered?: boolean }) {
  useLocale();
  return (
    <div className="empty">
      <Inbox size={30} />
      <strong>
        <StableText>
          {filtered ? t("Không có kết quả phù hợp") : t("Chưa có dữ liệu")}
        </StableText>
      </strong>
      <p>
        <StableText>
          {filtered
            ? t("Thử thay đổi hoặc bỏ bớt bộ lọc.")
            : t("Các thông tin mới sẽ xuất hiện tại đây.")}
        </StableText>
      </p>
    </div>
  );
}
