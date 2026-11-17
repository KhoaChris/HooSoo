import { t, useLocale } from "../../i18n";
import {
  certificateNames,
  groupBackgroundSkills,
  presetLabel,
  skillOptions,
} from "./background-options";
import "../../style/pages/employee-background.css";

export function BackgroundSkillGroups({
  skills,
  includeCertificates = false,
  headingLevel = 3,
}: {
  skills: readonly string[];
  includeCertificates?: boolean;
  headingLevel?: 3 | 5;
}) {
  useLocale();
  const groups = groupBackgroundSkills(skills, includeCertificates);
  const options = includeCertificates
    ? [...skillOptions, ...certificateNames]
    : skillOptions;
  const Heading = headingLevel === 5 ? "h5" : "h3";
  if (!groups.length) return null;
  return (
    <div className="employee-skill-groups">
      {groups.map((group) => (
        <div className="employee-skill-group" key={group.label}>
          <Heading className="employee-skill-group-heading">
            {t(group.label)}
          </Heading>
          <ul className="employee-skill-list" aria-label={t(group.label)}>
            {group.items.map((skill, index) => (
              <li key={`${skill}-${index}`}>{presetLabel(skill, options)}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
