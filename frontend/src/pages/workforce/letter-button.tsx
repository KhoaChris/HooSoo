import { useState } from "react";
import { Download } from "lucide-react";
import { Button, Modal, ErrorBox, Loading } from "../../components/ui";
import { useApi } from "../../hooks/data";
import { t } from "../../i18n";
import { dateLabel, printRecord } from "./common";
type Letter = {
  reference: string;
  company: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  position: string;
  hireDate: string;
  purpose: string;
  approvedAt: string;
  reviewer: string;
  resolution: string;
};
export function LetterButton({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Download size={16} />
        {t("Giấy xác nhận công tác")}
      </Button>
      {open && <LetterPreview id={requestId} onClose={() => setOpen(false)} />}
    </>
  );
}
function LetterPreview({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useApi<Letter>(`/workforce/letters/${id}`);
  const r = q.data,
    rows: [string, string][] = r
      ? [
          [t("Doanh nghiệp"), r.company],
          [t("Mã xác nhận"), r.reference],
          [t("Họ tên"), r.employeeName],
          [t("Mã nhân viên"), r.employeeCode],
          [t("Phòng ban"), r.department],
          [t("Chức danh"), r.position],
          [t("Ngày vào làm"), dateLabel(r.hireDate)],
          [t("Mục đích xác nhận"), r.purpose],
          [t("Người duyệt"), r.reviewer],
          [t("Ngày duyệt"), dateLabel(r.approvedAt)],
        ]
      : [];
  return (
    <Modal title={t("Giấy xác nhận công tác")} onClose={onClose}>
      <ErrorBox error={q.error} />
      {q.isLoading ? (
        <Loading />
      ) : (
        r && (
          <div className="wf-detail">
            <dl className="wf-dl">
              {rows.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p className="wf-hint">
              {t(
                "Bản xác nhận được tạo từ đề nghị đã duyệt và thông tin công việc hiện tại. Chữ ký và con dấu thực hiện theo quy định doanh nghiệp.",
              )}
            </p>
            <Button
              onClick={() =>
                printRecord(t("Giấy xác nhận công tác"), rows, r.resolution)
              }
            >
              {t("In / lưu PDF")}
            </Button>
          </div>
        )
      )}
    </Modal>
  );
}
