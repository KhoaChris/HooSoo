import { z } from "zod";

const text = z.string().trim().min(1, "Thông tin bắt buộc").max(150);
const year = z.string().regex(/^(19|20)\d{2}$/, "Chọn năm hợp lệ");
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const period = {
  startYear: year,
  endYear: z.union([year, z.literal("current")]),
};
const ordered = (v: { startYear: string; endYear: string }) =>
  v.endYear === "current" || v.endYear >= v.startYear;
const periodError = {
  message: "Năm kết thúc phải từ năm bắt đầu trở đi",
  path: ["endYear"],
};
export const educationEntrySchema = z
  .object({
    id,
    school: text,
    qualification: text,
    field: z.string().trim().max(150),
    ...period,
    description: z.string().trim().max(1500),
  })
  .strict()
  .refine(ordered, periodError);
export const experienceEntrySchema = z
  .object({
    id,
    company: text,
    position: text,
    ...period,
    description: z.string().trim().max(3000),
  })
  .strict()
  .refine(ordered, periodError);
export const certificateEntrySchema = z
  .object({
    id,
    name: text,
    issuer: text,
    issuedYear: z.union([year, z.literal("")]),
    expiresYear: z.union([year, z.literal("")]),
    credentialUrl: z.union([
      z.literal(""),
      z
        .url()
        .max(1000)
        .refine((v) => {
          const url = new URL(v);
          return url.protocol === "https:" && !url.username && !url.password;
        }, "Dùng đường dẫn HTTPS hợp lệ"),
    ]),
  })
  .strict()
  .refine(
    (v) => !v.issuedYear || !v.expiresYear || v.expiresYear >= v.issuedYear,
    { message: "Năm hết hạn phải từ năm cấp trở đi", path: ["expiresYear"] },
  );
export const backgroundSkillsSchema = z
  .array(text.max(80))
  .max(30)
  .refine(
    (items) =>
      new Set(items.map((s) => s.toLocaleLowerCase("vi"))).size ===
      items.length,
    "Kỹ năng không được trùng nhau",
  );
const uniqueEntries = <T extends { id: string }>(items: T[]) =>
  new Set(items.map((i) => i.id)).size === items.length;
// Candidate profiles include legacy free text, and certificates share the skills
// field. Preserve it verbatim instead of guessing schools, dates or issuers.
// This server-owned snapshot is intentionally absent from all change schemas.
export const recruitmentBackgroundSchema = z
  .object({
    candidateId: z.string().min(1).max(150),
    capturedAt: z.iso.datetime(),
    education: z.string().max(4000),
    experience: z.string().max(6000),
    skills: z.string().max(2000),
  })
  .strict();
export const employeeBackgroundSchema = z
  .object({
    version: z.number().int().nonnegative(),
    education: z
      .array(educationEntrySchema)
      .max(10)
      .refine(uniqueEntries, "Mục thông tin bị trùng"),
    experience: z
      .array(experienceEntrySchema)
      .max(15)
      .refine(uniqueEntries, "Mục thông tin bị trùng"),
    certificates: z
      .array(certificateEntrySchema)
      .max(20)
      .refine(uniqueEntries, "Mục thông tin bị trùng"),
    skills: backgroundSkillsSchema,
    recruitment: recruitmentBackgroundSchema.optional(),
  })
  .strict();
export const employeeBackgroundChangeSchema = z.discriminatedUnion("section", [
  z
    .object({
      section: z.literal("education"),
      version: z.number().int().nonnegative(),
      items: employeeBackgroundSchema.shape.education,
    })
    .strict(),
  z
    .object({
      section: z.literal("experience"),
      version: z.number().int().nonnegative(),
      items: employeeBackgroundSchema.shape.experience,
    })
    .strict(),
  z
    .object({
      section: z.literal("certificates"),
      version: z.number().int().nonnegative(),
      items: employeeBackgroundSchema.shape.certificates,
    })
    .strict(),
  z
    .object({
      section: z.literal("skills"),
      version: z.number().int().nonnegative(),
      items: backgroundSkillsSchema,
    })
    .strict(),
]);
export type EmployeeBackground = z.infer<typeof employeeBackgroundSchema>;
export type EmployeeBackgroundChange = z.infer<
  typeof employeeBackgroundChangeSchema
>;
export type BackgroundSection = EmployeeBackgroundChange["section"];
export const emptyEmployeeBackground = (): EmployeeBackground => ({
  version: 0,
  education: [],
  experience: [],
  certificates: [],
  skills: [],
});
