import { z } from "zod";
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Nhập mật khẩu hiện tại"),
    newPassword: z
      .string()
      .min(12, "Mật khẩu mới cần ít nhất 12 ký tự")
      .max(128, "Mật khẩu tối đa 128 ký tự"),
    confirmation: z.string(),
  })
  .strict()
  .refine((v) => v.newPassword === v.confirmation, {
    path: ["confirmation"],
    message: "Mật khẩu xác nhận không khớp",
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    path: ["newPassword"],
    message: "Mật khẩu mới phải khác mật khẩu hiện tại",
  });
export function localTokenLogging(development: boolean, hostname: string) {
  return development && ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
}
