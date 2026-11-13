import sharp from "sharp";
import {
  AVATAR_MAX_BYTES,
  AVATAR_SIZE,
  type Actor,
  type State,
} from "@hoosoo/shared";
import { assert, AppError, notFound } from "../../utils/errors";
import { assertManageEmployee, requireRole } from "../../common/authorization";
import { audit } from "../../common/audit";

// Decode and re-encode instead of trusting the MIME prefix. Only a small,
// metadata-free thumbnail is stored; original photos never enter Firestore.
export async function normalizeAvatar(image: string | null) {
  if (image === null) return null;
  try {
    const bytes = Buffer.from(image.slice(image.indexOf(",") + 1), "base64");
    const input = sharp(bytes, {
      limitInputPixels: 512 * 512,
      failOn: "warning",
    });
    const metadata = await input.metadata();
    if (
      !["jpeg", "png", "webp"].includes(metadata.format ?? "") ||
      (metadata.pages ?? 1) !== 1
    )
      throw new Error("Unsupported image");
    const result = await input
      .rotate()
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover" })
      .webp({ quality: 78, effort: 4 })
      .toBuffer();
    if (result.length > AVATAR_MAX_BYTES)
      throw new Error("Thumbnail too large");
    return "data:image/webp;base64," + result.toString("base64");
  } catch {
    throw new AppError(
      400,
      "INVALID_AVATAR",
      "Không đọc được ảnh này. Chọn ảnh JPG, PNG hoặc WebP khác và thử lại.",
    );
  }
}

export function saveAvatar(
  s: State,
  a: Actor,
  employeeId: string,
  image: string | null,
  version: number,
) {
  const employee = s.employees[employeeId];
  if (!employee) notFound();
  if (employeeId !== a.employeeId) {
    requireRole(a, ["Admin", "HR"]);
    assertManageEmployee(s, a, employeeId);
  }
  assert(
    (employee.avatarVersion ?? 0) === version,
    409,
    "AVATAR_VERSION_CONFLICT",
    "Ảnh đại diện đã được thay đổi ở nơi khác. Đóng và mở lại cửa sổ để cập nhật ảnh mới nhất.",
  );
  employee.avatarUrl = image;
  employee.avatarVersion = version + 1;
  audit(
    s,
    a,
    image ? "employee.avatar_updated" : "employee.avatar_removed",
    employeeId,
    { name: employee.name },
  );
  // Do not duplicate the image in the persistent idempotency receipt or audit.
  return { id: employeeId, avatarVersion: employee.avatarVersion };
}
