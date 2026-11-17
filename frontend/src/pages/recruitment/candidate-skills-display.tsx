import { t, useLocale } from "../../i18n";
import { BackgroundSkillGroups } from "../employees/background-skills-display";
import { candidateSkillsDefaults } from "./candidate-background-model";

export function CandidateSkillsDisplay({ value }: { value: string }) {
  useLocale();
  const { selected, details } = candidateSkillsDefaults(value);
  if (!selected.length && !details.trim())
    return <p className="is-empty">{t("Chưa cung cấp")}</p>;
  return (
    <>
      <BackgroundSkillGroups
        skills={selected}
        includeCertificates
        headingLevel={5}
      />
      {details.trim() && (
        <div className="candidate-skills-details">
          <h5>{t("Thông tin bổ sung / nội dung đã có")}</h5>
          <p>{details}</p>
        </div>
      )}
    </>
  );
}
