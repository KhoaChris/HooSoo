import { describe, expect, it } from "vitest";
import type { Candidate, RecruitmentJob } from "@hoosoo/shared";
import {
  candidateCardModel,
  candidateEnglish,
  candidateScore,
  candidateSkills,
  candidateMatch,
} from "../src/pages/recruitment/candidate-card-model";

const job: RecruitmentJob = {
  id: "job",
  title: "Developer",
  departmentId: "tech",
  hiringManagerId: "manager",
  description: "",
  openings: 2,
  active: true,
  version: 1,
  stages: [
    { id: "screening", name: "Sơ tuyển", kind: "screening" },
    { id: "interview", name: "Phỏng vấn", kind: "interview" },
    { id: "decision", name: "Quyết định", kind: "decision" },
  ],
};
const candidate: Candidate = {
  id: "candidate",
  jobId: job.id,
  name: "Nguyễn An",
  email: "an@example.test",
  phone: "",
  address: "",
  education: "Cử nhân CNTT",
  skills: "TypeScript",
  experience: "3 năm",
  source: "application",
  note: "",
  stageId: "screening",
  status: "active",
  version: 1,
  rounds: [],
  interviewDates: [],
  history: [],
  cv: null,
};

describe("candidate card evidence", () => {
  it("uses the weighted screening percentage without rounding it back to a legacy score", () => {
    const reviewed: Candidate = {
      ...candidate,
      rounds: [
        {
          stageId: "screening",
          stageName: "Sơ tuyển",
          result: "passed",
          score: 4,
          assessment: {
            rubricVersion: 1,
            kind: "screening",
            totalPercent: 86,
            strengths: "Giải pháp có căn cứ",
            concerns: "Cần thêm kinh nghiệm",
            ratings: [
              {
                criterionId: "knowledge",
                rating: 5,
                evidence: "Dự án đã hoàn thành",
              },
              { criterionId: "experience", rating: 4, evidence: "" },
              { criterionId: "skills", rating: 4, evidence: "" },
              { criterionId: "evidence", rating: 4, evidence: "" },
            ],
          },
        },
      ],
    };
    expect(candidateMatch(reviewed, job)).toEqual({
      score: 4,
      percent: 86,
      criterionCount: 4,
    });
  });
  it("keeps the percentage anchored to screening after a stage move", () => {
    const screened: Candidate = {
      ...candidate,
      rounds: [
        {
          stageId: "screening",
          stageName: "Sơ tuyển",
          result: "passed",
          score: 4,
        },
        {
          stageId: "interview",
          stageName: "Phỏng vấn",
          result: "passed",
          score: 5,
        },
      ],
    };
    expect(candidateMatch(screened, job)).toEqual({ score: 4, percent: 80 });
    expect(candidateMatch({ ...screened, stageId: "interview" }, job)).toEqual({
      score: 4,
      percent: 80,
    });
    expect(
      candidateMatch(
        { ...screened, status: "hired", stageId: "decision" },
        job,
      ),
    ).toEqual({ score: 4, percent: 80 });
  });
  it("does not manufacture a percentage from a later review, direct hire, or another job", () => {
    expect(
      candidateMatch(
        {
          ...candidate,
          status: "hired",
          rounds: [
            {
              stageId: "decision",
              stageName: "Quyết định",
              result: "passed",
              score: 5,
            },
          ],
        },
        job,
      ),
    ).toBeNull();
    const screened: Candidate = {
      ...candidate,
      rounds: [
        {
          stageId: "screening",
          stageName: "Sơ tuyển",
          result: "passed",
          score: 4,
        },
      ],
    };
    expect(
      candidateMatch(screened, { ...job, id: "another-position" }),
    ).toBeNull();
    expect(candidateMatch(candidate, job)).toBeNull();
  });
  it("keeps the review decision separate from its percentage display", () => {
    const screened: Candidate = {
      ...candidate,
      rounds: [
        {
          stageId: "screening",
          stageName: "Sơ tuyển",
          result: "failed",
          score: 4,
        },
      ],
    };
    const model = candidateCardModel(screened, job);
    expect(model.match?.percent).toBe(80);
    expect(model.round?.result).toBe("failed");
    expect(screened.status).toBe("active");
  });
  it("does not infer English proficiency or fit from technical skills or a degree", () => {
    expect(
      candidateEnglish({
        education: "Computer Science",
        skills: "React, B2, TypeScript",
      }),
    ).toBeNull();
    expect(candidateCardModel(candidate, job).score).toBeNull();
  });
  it("preserves language evidence and negation exactly as supplied", () => {
    expect(
      candidateEnglish({
        education: "Cử nhân",
        skills: "React; Tiếng Anh: IELTS 6.5",
      }),
    ).toBe("Tiếng Anh: IELTS 6.5");
    expect(
      candidateEnglish({
        education: "English: basic reading only",
        skills: "TypeScript",
      }),
    ).toBe("English: basic reading only");
    expect(
      candidateEnglish({
        education: "CNTT",
        skills: "Chưa có chứng chỉ IELTS",
      }),
    ).toBe("Chưa có chứng chỉ IELTS");
  });
  it("requires a real reviewed score on the existing 1–5 scale", () => {
    const round = { stageId: "screening", stageName: "Sơ tuyển" };
    expect(candidateScore({ ...round, score: 4 })).toBeNull();
    expect(candidateScore({ ...round, result: "passed", score: 4 })).toBe(4);
    for (const score of [0, 6, 4.5, NaN])
      expect(candidateScore({ ...round, result: "passed", score })).toBeNull();
  });
  it("separates technical skill chips from a language qualification", () => {
    expect(
      candidateSkills("React, TypeScript; Tiếng Anh: IELTS 6.5\nSQL"),
    ).toEqual(["React", "TypeScript", "SQL"]);
  });
  it("keeps a failed interview distinct from a final rejection", () => {
    const model = candidateCardModel(
      {
        ...candidate,
        stageId: "interview",
        rounds: [
          {
            stageId: "interview",
            stageName: "Phỏng vấn",
            result: "failed",
            score: 2,
          },
        ],
      },
      job,
    );
    expect(model.kind).toBe("interview");
    expect(model.round?.result).toBe("failed");
    expect(model.decision).toBeUndefined();
    expect(model.previousStages[0].result).toBeUndefined();
  });
  it("shows direct hiring from its actual event without inventing passed rounds", () => {
    const event = {
      action: "direct_hired",
      at: "2026-11-13T02:00:00Z",
      by: "hr",
      name: "Nhân sự",
      reason: "Phê duyệt tuyển thẳng",
    };
    const model = candidateCardModel(
      {
        ...candidate,
        status: "hired",
        history: [event, { ...event, action: "employee_created" }],
      },
      job,
    );
    expect(model.kind).toBe("hired");
    expect(model.decision).toEqual(event);
    expect(model.score).toBeNull();
  });
  it("uses rejection evidence only for rejected candidates and keeps missing evidence empty", () => {
    expect(
      candidateCardModel({ ...candidate, status: "hired" }, job).decision,
    ).toBeUndefined();
    const rejection = {
      action: "rejected",
      at: "2026-11-13T02:00:00Z",
      by: "hr",
      name: "Nhân sự",
      reason: "Chưa đáp ứng yêu cầu",
    };
    expect(
      candidateCardModel(
        { ...candidate, status: "rejected", history: [rejection] },
        job,
      ).decision,
    ).toEqual(rejection);
    expect(
      candidateCardModel({ ...candidate, stageId: "removed" }, job)
        .previousStages,
    ).toEqual([]);
  });
});
