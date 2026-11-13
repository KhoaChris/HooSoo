import { z } from "zod";

export const AVATAR_SIZE = 192;
export const AVATAR_MAX_BYTES = 16 * 1024;
export const avatarSchema = z
  .object({
    image: z
      .string()
      .max(60_000, "Ảnh quá lớn. Vui lòng chọn lại ảnh.")
      .regex(
        /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/,
        "Chọn ảnh JPG, PNG hoặc WebP hợp lệ.",
      )
      .nullable(),
    version: z.number().int().nonnegative(),
  })
  .strict();
export type AvatarInput = z.infer<typeof avatarSchema>;
