import { describe, expect, it } from "vitest";
import {
  assessmentCriteria,
  assessmentPercent,
  assessmentRatingPercent,
  recruitmentAssessmentSchema,
  evaluationSchema,
  defaultRecruitmentStages,
  type AssessmentKind,
  type RecruitmentAssessmentInput,
} from "@hoosoo/shared";
import { fixture, actor } from "./fixture";
import * as recruiting from "../src/modules/recruitment/recruitment.service";

const review = (
  kind: AssessmentKind = "screening",
): RecruitmentAssessmentInput => ({
  rubricVersion: 1,
  kind,
  ratings: assessmentCriteria[kind].map((c) => ({
    criterionId: c.id,
    rating: 4,
    evidence: "Có minh chứng qua dự án",
  })),
  strengths: "Trình bày giải pháp rõ ràng",
  concerns: "Cần làm rõ kinh nghiệm vận hành",
});
function setup() {
  const s = fixture(),
    a = actor("HR");
  const j = recruiting.saveJob(s, a, {
    title: "Kỹ sư phần mềm",
    departmentId: "a",
    hiringManagerId: "manager",
    description: "Phát triển sản phẩm",
    openings: 1,
    stages: defaultRecruitmentStages,
    active: true,
    version: 0,
  });
  const c = recruiting.createCandidate(s, a, {
    jobId: j.id,
    name: "Ứng viên kiểm thử",
    email: "review@example.test",
    phone: "0900000000",
    address: "",
    education: "Cử nhân CNTT",
    experience: "3 năm",
    skills: "TypeScript",
    source: "application",
    note: "",
  });
  return { s, a, j, c };
}
const evaluate = (assessment = review()) => ({
  version: 1,
  result: "passed" as const,
  reason: "Đáp ứng yêu cầu của vòng đánh giá",
  assessment,
});

describe("versioned recruitment scorecards", () => {
  it.each(["screening", "interview", "decision"] as const)(
    "computes % from all weighted criteria for %s",
    (kind) => {
      expect(assessmentCriteria[kind].reduce((s, c) => s + c.weight, 0)).toBe(
        100,
      );
      expect(assessmentPercent(review(kind))).toBe(80);
      const r = review(kind);
      r.ratings[0].rating = 5;
      expect(assessmentPercent(r)).toBe(
        80 + assessmentCriteria[kind][0].weight / 5,
      );
      expect(assessmentRatingPercent(kind, r.ratings.slice(1))).toBeNull();
    },
  );
  it("rejects incomplete, repeated, unknown criteria and client-supplied totals", () => {
    const original = review();
    for (const ratings of [
      original.ratings.slice(1),
      [...original.ratings, original.ratings[0]],
      original.ratings.map((r, i) => (i === 1 ? original.ratings[0] : r)),
      original.ratings.map((r, i) =>
        i === 0 ? { ...r, criterionId: "unknown" } : r,
      ),
    ]) {
      expect(
        recruitmentAssessmentSchema.safeParse({ ...original, ratings }).success,
      ).toBe(false);
    }
    for (const rating of [0, 6, 2.5, NaN]) {
      const bad = {
        ...original,
        ratings: original.ratings.map((r, i) =>
          i === 0 ? { ...r, rating } : r,
        ),
      };
      expect(recruitmentAssessmentSchema.safeParse(bad).success).toBe(false);
      expect(assessmentRatingPercent("screening", bad.ratings)).toBeNull();
    }
    expect(
      recruitmentAssessmentSchema.safeParse({ ...original, totalPercent: 100 })
        .success,
    ).toBe(false);
    expect(
      recruitmentAssessmentSchema.safeParse({ ...original, kind: "decision" })
        .success,
    ).toBe(false);
    expect(
      recruitmentAssessmentSchema.safeParse({ ...original, strengths: "  " })
        .success,
    ).toBe(false);
    expect(
      evaluationSchema.safeParse({ ...evaluate(), result: undefined }).success,
    ).toBe(false);
    expect(
      evaluationSchema.safeParse({
        version: 1,
        result: "passed",
        reason: "Kết luận hợp lệ",
      }).success,
    ).toBe(false);
  });
  it("persists complete evidence, derives legacy score on the server and preserves stage progression", () => {
    const { s, a, c, j } = setup();
    const input = { ...evaluate(), score: 1 };
    recruiting.evaluateCandidate(s, a, c.id, input);
    expect(c.rounds[0].assessment).toEqual({ ...review(), totalPercent: 80 });
    expect(c.rounds[0].score).toBe(4);
    expect(c.rounds[0].evaluatedBy).toBe(a.uid);
    expect(c.version).toBe(2);
    input.assessment.ratings[0].rating = 1;
    expect(c.rounds[0].assessment!.ratings[0].rating).toBe(4);
    expect(
      JSON.parse(JSON.stringify(s.candidates[c.id])).rounds[0].assessment,
    ).toEqual(c.rounds[0].assessment);
    recruiting.moveCandidate(s, a, c.id, {
      version: 2,
      stageId: j.stages[1].id,
      reason: "Chuyển vòng tiếp theo",
    });
    expect(c.rounds[0].assessment?.totalPercent).toBe(80);
    expect(c.rounds[1].assessment).toBeUndefined();
  });
  it("leaves state unchanged on wrong stage, stale version or unauthorized reviewer", () => {
    const { s, a, c } = setup(),
      before = JSON.stringify(s);
    expect(() =>
      recruiting.evaluateCandidate(s, a, c.id, evaluate(review("interview"))),
    ).toThrow();
    expect(() =>
      recruiting.evaluateCandidate(s, a, c.id, { ...evaluate(), version: 9 }),
    ).toThrow();
    expect(() =>
      recruiting.evaluateCandidate(s, actor("Employee"), c.id, evaluate()),
    ).toThrow();
    expect(() =>
      recruiting.evaluateCandidate(
        s,
        actor("Manager", "manager2"),
        c.id,
        evaluate(),
      ),
    ).toThrow();
    expect(JSON.stringify(s)).toBe(before);
  });
  it("does not let a high score pass a failed result or bypass interview confirmation/time", () => {
    const { s, a, c, j } = setup();
    const r = review();
    r.ratings.forEach((r) => (r.rating = 5));
    recruiting.evaluateCandidate(s, a, c.id, {
      ...evaluate(r),
      result: "failed",
    });
    expect(() =>
      recruiting.moveCandidate(s, a, c.id, {
        version: 2,
        stageId: j.stages[1].id,
        reason: "Chuyển vòng tiếp theo",
      }),
    ).toThrow();
    recruiting.evaluateCandidate(s, a, c.id, { ...evaluate(), version: 2 });
    recruiting.moveCandidate(s, a, c.id, {
      version: 3,
      stageId: j.stages[1].id,
      reason: "Chuyển vòng tiếp theo",
    });
    const input = { ...evaluate(review("interview")), version: 4 };
    expect(() => recruiting.evaluateCandidate(s, a, c.id, input)).toThrow();
    c.rounds[1].interview = {
      date: "2099-11-12",
      start: "09:00",
      end: "10:00",
      interviewerId: "manager",
      interviewerName: "Quản lý",
      location: "Phòng họp A",
      status: "confirmed",
      confirmedBy: a.uid,
    };
    expect(() => recruiting.evaluateCandidate(s, a, c.id, input)).toThrow();
    c.rounds[1].interview!.date = "2020-11-12";
    recruiting.evaluateCandidate(s, actor("Manager"), c.id, input);
    expect(c.rounds[1].assessment?.totalPercent).toBe(80);
    expect(c.rounds[1].assessment?.ratings).toHaveLength(5);
  });
  it("keeps old clients valid and removes stale structured data on legacy reevaluation", () => {
    const { s, a, c } = setup();
    recruiting.evaluateCandidate(s, a, c.id, evaluate());
    const legacy = {
      version: 2,
      result: "failed" as const,
      score: 2,
      reason: "Cần bổ sung kinh nghiệm",
    };
    expect(evaluationSchema.safeParse(legacy).success).toBe(true);
    recruiting.evaluateCandidate(s, a, c.id, legacy);
    expect(c.rounds[0].assessment).toBeUndefined();
    expect(c.rounds[0].score).toBe(2);
  });
});
