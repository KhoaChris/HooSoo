import { z } from "zod";

export type AssessmentKind = "screening" | "interview" | "decision";
export const assessmentLevels = [
  { value: 1, label: "Chưa đáp ứng" },
  { value: 2, label: "Cần cải thiện" },
  { value: 3, label: "Đáp ứng" },
  { value: 4, label: "Đáp ứng tốt" },
  { value: 5, label: "Vượt yêu cầu" },
] as const;

// Version 1 is immutable: stored reviews retain their original meaning/weights.
export const assessmentCriteria = {
  screening: [
    {
      id: "knowledge",
      label: "Nền tảng chuyên môn",
      detail: "Kiến thức liên quan đến công việc",
      weight: 30,
    },
    {
      id: "experience",
      label: "Kinh nghiệm liên quan",
      detail: "Vai trò, dự án và phạm vi đã đảm nhiệm",
      weight: 30,
    },
    {
      id: "skills",
      label: "Kỹ năng theo vị trí",
      detail: "Công cụ và kỹ năng được yêu cầu",
      weight: 25,
    },
    {
      id: "evidence",
      label: "Minh chứng năng lực",
      detail: "Sản phẩm, portfolio hoặc kết quả công việc",
      weight: 15,
    },
  ],
  interview: [
    {
      id: "expertise",
      label: "Năng lực chuyên môn",
      detail: "Kiến thức và cách áp dụng vào tình huống",
      weight: 30,
    },
    {
      id: "problem_solving",
      label: "Giải quyết vấn đề",
      detail: "Phân tích, lựa chọn giải pháp và lập luận",
      weight: 25,
    },
    {
      id: "communication",
      label: "Giao tiếp công việc",
      detail: "Trình bày, lắng nghe và làm rõ yêu cầu",
      weight: 15,
    },
    {
      id: "collaboration",
      label: "Phối hợp đội ngũ",
      detail: "Phản hồi và xử lý khác biệt trong công việc",
      weight: 15,
    },
    {
      id: "delivery",
      label: "Tổ chức & thực thi",
      detail: "Ưu tiên, theo dõi tiến độ và trách nhiệm",
      weight: 15,
    },
  ],
  decision: [
    {
      id: "requirements",
      label: "Đáp ứng yêu cầu vị trí",
      detail: "Đối chiếu yêu cầu tuyển dụng và các vòng trước",
      weight: 35,
    },
    {
      id: "readiness",
      label: "Khả năng đảm nhiệm",
      detail: "Mức độ sẵn sàng thực hiện công việc",
      weight: 30,
    },
    {
      id: "collaboration",
      label: "Phối hợp đội ngũ",
      detail: "Khả năng phối hợp trong phạm vi vai trò",
      weight: 20,
    },
    {
      id: "development",
      label: "Khả năng phát triển",
      detail: "Tiếp thu phản hồi và kế hoạch nâng cao năng lực",
      weight: 15,
    },
  ],
} as const;

export const recruitmentAssessmentSchema = z
  .object({
    rubricVersion: z.literal(1),
    kind: z.enum(["screening", "interview", "decision"]),
    ratings: z
      .array(
        z
          .object({
            criterionId: z.string().max(40),
            rating: z.number().int().min(1).max(5),
            evidence: z.string().trim().max(300).default(""),
          })
          .strict(),
      )
      .min(4)
      .max(5),
    strengths: z.string().trim().min(5, "Nêu điểm mạnh có căn cứ.").max(1000),
    concerns: z
      .string()
      .trim()
      .min(5, "Nêu điểm cần làm rõ hoặc chưa ghi nhận.")
      .max(1000),
  })
  .strict()
  .superRefine((value, ctx) => {
    const expected = assessmentCriteria[value.kind].map((c) => c.id);
    const actual = value.ratings.map((r) => r.criterionId);
    if (
      actual.length !== expected.length ||
      new Set(actual).size !== actual.length ||
      expected.some((id) => !actual.includes(id))
    )
      ctx.addIssue({
        code: "custom",
        path: ["ratings"],
        message: "Đánh giá đầy đủ các tiêu chí của vòng tuyển dụng.",
      });
  });
export type RecruitmentAssessmentInput = z.infer<
  typeof recruitmentAssessmentSchema
>;
export type RecruitmentAssessment = RecruitmentAssessmentInput & {
  totalPercent: number;
};

export function assessmentPercent(
  assessment: RecruitmentAssessmentInput,
): number {
  const valid = recruitmentAssessmentSchema.parse(assessment);
  return assessmentRatingPercent(valid.kind, valid.ratings)!;
}

export function assessmentRatingPercent(
  kind: AssessmentKind,
  ratings: { criterionId: string; rating: number }[],
): number | null {
  const criteria = assessmentCriteria[kind];
  if (
    ratings.length !== criteria.length ||
    new Set(ratings.map((r) => r.criterionId)).size !== criteria.length ||
    criteria.some(
      (c) =>
        !ratings.some(
          (r) =>
            r.criterionId === c.id &&
            Number.isInteger(r.rating) &&
            r.rating >= 1 &&
            r.rating <= 5,
        ),
    )
  )
    return null;
  return Math.round(
    criteria.reduce((sum, criterion) => {
      const rating = ratings.find(
        (r) => r.criterionId === criterion.id,
      )!.rating;
      return sum + (rating / 5) * criterion.weight;
    }, 0),
  );
}
