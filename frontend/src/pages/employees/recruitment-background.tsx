import { FileCheck2 } from "lucide-react";
import type { EmployeeBackground } from "@hoosoo/shared";
import { t } from "../../i18n";
import {
  candidateSummaryText,
  candidateSkillsText,
} from "../recruitment/candidate-background-display";

export function RecruitmentBackground({
  background,
  canEdit,
}: {
  background: EmployeeBackground;
  canEdit: boolean;
}) {
  const source = background.recruitment;
  if (
    !source ||
    ![source.education, source.experience, source.skills].some((v) => v.trim())
  )
    return null;
  const items = [
    {
      label: "Học vấn & bằng cấp",
      value: candidateSummaryText(source.education, "education"),
    },
    {
      label: "Kinh nghiệm làm việc",
      value: candidateSummaryText(source.experience, "experience"),
    },
    { label: "Kỹ năng & chứng chỉ", value: candidateSkillsText(source.skills) },
  ];
  return (
    <section
      className="employee-background-section employee-recruitment-background"
      aria-labelledby="recruitment-background-title"
    >
      <header className="employee-section-heading">
        <h2 id="recruitment-background-title">
          <FileCheck2 size={18} aria-hidden="true" />
          {t("Hồ sơ từ tuyển dụng")}
        </h2>
      </header>
      <p className="employee-background-source-hint">
        {t(
          canEdit
            ? "Giữ đầy đủ nội dung tại thời điểm nhận việc. Bạn có thể bổ sung các mục chi tiết bên dưới."
            : "Giữ đầy đủ nội dung tại thời điểm nhận việc.",
        )}
      </p>
      <dl className="employee-recruitment-records">
        {items
          .filter((item) => item.value.trim())
          .map((item) => (
            <div key={item.label}>
              <dt>{t(item.label)}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
      </dl>
    </section>
  );
}
