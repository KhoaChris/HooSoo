import { t } from "../../i18n";
import { AVATAR_SIZE } from "@hoosoo/shared";
export type AvatarSource = { image: HTMLImageElement; url: string };
export async function readAvatar(file: File): Promise<AvatarSource> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error(t("Chọn ảnh JPG, PNG hoặc WebP."));
  if (file.size > 8 * 1024 * 1024)
    throw new Error(t("Ảnh tối đa 8 MB. Vui lòng chọn ảnh nhỏ hơn."));
  const url = URL.createObjectURL(file),
    image = new Image();
  try {
    image.src = url;
    await image.decode();
    if (
      !image.naturalWidth ||
      image.naturalWidth * image.naturalHeight > 40_000_000
    )
      throw new Error();
    return { image, url };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error(
      t("Không đọc được ảnh hoặc ảnh quá lớn. Vui lòng chọn ảnh khác."),
    );
  }
}
export function cropAvatar(
  source: AvatarSource,
  zoom: number,
  x: number,
  y: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = AVATAR_SIZE;
  const context = canvas.getContext("2d")!;
  const { image } = source,
    side = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  context.drawImage(
    image,
    ((image.naturalWidth - side) * x) / 100,
    ((image.naturalHeight - side) * y) / 100,
    side,
    side,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE,
  );
  return canvas.toDataURL("image/jpeg", 0.86);
}
