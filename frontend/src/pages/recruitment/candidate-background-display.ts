import { t } from "../../i18n";
import {
  qualifications,
  studyFields,
  experiencePositions,
  skillOptions,
  certificateNames,
  presetLabel,
} from "../employees/background-options";
import {
  candidateSummaryDefaults,
  candidateSkillsDefaults,
  type SummaryKind,
} from "./candidate-background-model";

export function candidateSummaryText(value: string, kind: SummaryKind) {
  const draft = candidateSummaryDefaults(value, kind);
  if (draft.mode === "custom") return value;
  const title = [
    presetLabel(
      draft.primary,
      kind === "education" ? qualifications : experiencePositions,
    ),
    presetLabel(draft.secondary, studyFields),
  ]
    .filter(Boolean)
    .join(" · ");
  return [title, draft.details].filter(Boolean).join("\n\n");
}

export function candidateSkillsText(value: string) {
  const draft = candidateSkillsDefaults(value);
  if (!draft.selected.length) return value;
  return (
    [
      draft.selected
        .map((item) =>
          presetLabel(item, [...skillOptions, ...certificateNames]),
        )
        .join(" · "),
      draft.details,
    ]
      .filter(Boolean)
      .join("\n\n") || t("Chưa cung cấp")
  );
}
