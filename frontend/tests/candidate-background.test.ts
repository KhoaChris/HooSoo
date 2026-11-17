import { describe, expect, it } from "vitest";
import {
  candidateSummaryDefaults,
  candidateSummarySchema,
  serializeCandidateSummary,
  candidateSkillsDefaults,
  candidateSkillsSchema,
  serializeCandidateSkills,
} from "../src/pages/recruitment/candidate-background-model";
import {
  candidateEnglish,
  candidateSkills,
} from "../src/pages/recruitment/candidate-card-model";

describe("candidate guided background compatibility", () => {
  it.each(["education", "experience"] as const)(
    "preserves arbitrary legacy %s text byte for byte before edits",
    (kind) => {
      const original =
        "Bằng cấp riêng, công ty A; 2020–2026\n\nMô tả nhiều dòng: React / nghiệp vụ đặc thù.\nThành tích";
      const draft = candidateSummaryDefaults(original, kind);
      expect(draft.mode).toBe("custom");
      expect(draft.custom).toBe(original);
      expect(candidateSummarySchema(kind).parse(draft)).toBe(original);
    },
  );
  it("reopens a new qualification without a major after API trimming", () => {
    const draft = {
      ...candidateSummaryDefaults("", "education"),
      changed: true,
      primary: "Đại học",
    };
    const saved = candidateSummarySchema("education").parse(draft);
    const reopened = candidateSummaryDefaults(saved, "education");
    expect(reopened.mode).toBe("guided");
    expect(reopened.primary).toBe("Đại học");
    expect(reopened.secondary).toBe("");
    expect(candidateSummarySchema("education").parse(reopened)).toBe(saved);
  });
  it.each(["education", "experience"] as const)(
    "round trips custom %s choices and preserves multiline details",
    (kind) => {
      const draft = {
        ...candidateSummaryDefaults("", kind),
        changed: true,
        primary: "Nghiệp vụ riêng",
        secondary: kind === "education" ? "Chuyên ngành riêng" : "",
        details: "Đơn vị A\n\n2019–2026\nChứng nhận: kiểm thử",
      };
      const saved = candidateSummarySchema(kind).parse(draft);
      const reopened = candidateSummaryDefaults(saved, kind);
      expect(reopened).toMatchObject({
        primary: draft.primary,
        secondary: draft.secondary,
        details: draft.details,
      });
      expect(
        serializeCandidateSummary({ ...reopened, changed: true }, kind),
      ).toBe(saved);
    },
  );
  it("does not partially parse a legacy heading with additional prose", () => {
    const original =
      "Bằng cấp / trình độ: Đại học\nThông tin tự do\nChuyên ngành: CNTT";
    expect(candidateSummaryDefaults(original, "education").custom).toBe(
      original,
    );
    expect(candidateSummaryDefaults(original, "education").mode).toBe("custom");
  });
  it.each(["education", "experience"] as const)(
    "rejects blank required %s choices and retains original API size limits",
    (kind) => {
      expect(
        candidateSummarySchema(kind).safeParse(
          candidateSummaryDefaults("", kind),
        ).success,
      ).toBe(false);
      const draft = {
        ...candidateSummaryDefaults("", kind),
        changed: true,
        primary: "Đại học",
        details: "x".repeat(kind === "education" ? 4000 : 6000),
      };
      expect(candidateSummarySchema(kind).safeParse(draft).success).toBe(false);
      expect(
        candidateSummarySchema(kind).safeParse({
          ...draft,
          mode: "custom",
          custom: " ",
        }).success,
      ).toBe(false);
    },
  );
  it("keeps existing skills, certificate scores and punctuation while adding presets", () => {
    const original =
      "React, TypeScript; Tiếng Anh: IELTS 6.5\n\nĐơn vị cấp: ABC; mã riêng 123";
    const draft = candidateSkillsDefaults(original);
    expect(candidateSkillsSchema.parse(draft)).toBe(original);
    const saved = candidateSkillsSchema.parse({
      ...draft,
      changed: true,
      selected: [
        "Giao tiếp",
        "ISTQB CTFL",
        "Kỹ năng khác, có dấu phẩy; thêm mô tả",
      ],
    });
    const reopened = candidateSkillsDefaults(saved);
    expect(reopened.details).toBe(original);
    expect(reopened.selected).toEqual([
      "Giao tiếp",
      "ISTQB CTFL",
      "Kỹ năng khác, có dấu phẩy; thêm mô tả",
    ]);
    expect(
      serializeCandidateSkills({ ...reopened, changed: true, selected: [] }),
    ).toBe(original);
    expect(candidateEnglish({ education: "", skills: saved })).toBe(
      "Tiếng Anh: IELTS 6.5",
    );
    expect(candidateSkills(saved)).not.toContain("Kỹ năng & chứng chỉ:");
  });
  it("round trips skill choices without extra details and enforces the API total limit", () => {
    const draft = {
      ...candidateSkillsDefaults(""),
      changed: true,
      selected: ["React", "Chứng nhận riêng"],
    };
    const saved = candidateSkillsSchema.parse(draft);
    expect(candidateSkillsDefaults(saved).selected).toEqual(draft.selected);
    expect(
      candidateSkillsSchema.safeParse({ ...draft, details: "x".repeat(2000) })
        .success,
    ).toBe(false);
  });
  it("keeps recorded language evidence ahead of a generic certificate selection", () => {
    for (const evidence of ["IELTS 6.5", "Chưa có chứng chỉ IELTS"]) {
      const skills = candidateSkillsSchema.parse({
        ...candidateSkillsDefaults(evidence),
        changed: true,
        selected: ["IELTS"],
      });
      expect(candidateEnglish({ education: "", skills })).toBe(evidence);
    }
  });
});
