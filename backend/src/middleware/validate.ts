import { z } from "zod";
import { AppError } from "../utils/errors";
export function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "form";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Vui lòng kiểm tra lại thông tin.",
      fieldErrors,
    );
  }
  return result.data;
}
