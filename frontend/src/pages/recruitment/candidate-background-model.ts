import { z } from "zod";
import { candidateSchema } from "@hoosoo/shared";

export type SummaryKind = "education" | "experience";
export type CandidateSummaryDraft = {
  original: string;
  changed: boolean;
  mode: "guided" | "custom";
  primary: string;
  secondary: string;
  details: string;
  custom: string;
};
export type CandidateSkillsDraft = {
  original: string;
  changed: boolean;
  selected: string[];
  details: string;
};

// Human-readable summaries keep the existing API and stored text format.
// Only our exact headings are unpacked; unrecognized legacy prose stays intact.
const headings = {
  education: ["Bằng cấp / trình độ:", "Chuyên ngành:"],
  experience: ["Vị trí đảm nhiệm:"],
};
const skillsHeading = "Kỹ năng & chứng chỉ:\n";
const splitDetails = (text: string) => {
  const at = text.indexOf("\n\n");
  return at < 0 ? [text, ""] : [text.slice(0, at), text.slice(at + 2)];
};
const withDetails = (summary: string, details: string) =>
  summary && details ? `${summary}\n\n${details}` : summary || details;

export function candidateSummaryDefaults(
  original: string,
  kind: SummaryKind,
): CandidateSummaryDraft {
  const [head, details] = splitDetails(original);
  const lines = head.split("\n");
  const keys = headings[kind];
  const recognized =
    lines.length === keys.length &&
    keys.every((key, index) => lines[index].startsWith(key));
  return {
    original,
    changed: false,
    mode: recognized || !original ? "guided" : "custom",
    primary: recognized ? lines[0].slice(keys[0].length).replace(/^ /, "") : "",
    secondary:
      recognized && keys[1]
        ? lines[1].slice(keys[1].length).replace(/^ /, "")
        : "",
    details: recognized ? details : original,
    custom: original,
  };
}

export function serializeCandidateSummary(
  draft: CandidateSummaryDraft,
  kind: SummaryKind,
) {
  if (!draft.changed) return draft.original;
  if (draft.mode === "custom") return draft.custom;
  if (!draft.primary && !draft.secondary) return draft.details;
  const keys = headings[kind];
  return withDetails(
    keys
      .map((key, i) => key + " " + (i ? draft.secondary : draft.primary))
      .join("\n"),
    draft.details,
  );
}

export const candidateSummarySchema = (kind: SummaryKind) =>
  z
    .custom<CandidateSummaryDraft>()
    .superRefine((draft, ctx) => {
      if (draft.mode === "guided" && !draft.primary.trim())
        ctx.addIssue({
          code: "custom",
          message: "Chọn một mục hoặc nhập nội dung khác.",
        });
    })
    .transform((draft) => serializeCandidateSummary(draft, kind))
    .pipe(candidateSchema.shape[kind]);

export function candidateSkillsDefaults(
  original: string,
): CandidateSkillsDraft {
  const [head, details] = splitDetails(original);
  const lines = head.startsWith(skillsHeading)
    ? head.slice(skillsHeading.length).split("\n")
    : [];
  const recognized =
    lines.length > 0 && lines.every((line) => line.startsWith("• "));
  return {
    original,
    changed: false,
    selected: recognized ? lines.map((line) => line.slice(2)) : [],
    details: recognized ? details : original,
  };
}

export function serializeCandidateSkills(draft: CandidateSkillsDraft) {
  if (!draft.changed) return draft.original;
  return withDetails(
    draft.selected.length
      ? skillsHeading + draft.selected.map((item) => `• ${item}`).join("\n")
      : "",
    draft.details,
  );
}
export const candidateSkillsSchema = z
  .custom<CandidateSkillsDraft>()
  .transform(serializeCandidateSkills)
  .pipe(candidateSchema.shape.skills);
