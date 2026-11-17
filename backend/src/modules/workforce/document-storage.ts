import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import { env, ORG_ID } from "../../config/env";
import { assert } from "../../utils/errors";
const root = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  import.meta.url.includes("/src/modules/") ? "../../.." : "..",
);
const directory = resolve(
  process.env.HR_DOCUMENT_DIR || resolve(root, ".private/personnel"),
  ORG_ID,
);
function storageKey(key: string) {
  assert(
    /^[a-f0-9]{64}$/.test(key),
    400,
    "DOCUMENT_KEY",
    "Mã tài liệu không hợp lệ.",
  );
  return `${ORG_ID}/personnel/${key}`;
}
function localAllowed() {
  assert(
    env.NODE_ENV !== "production",
    503,
    "DOCUMENT_STORAGE_REQUIRED",
    "Cần cấu hình kho tài liệu riêng trước khi sử dụng trên production.",
  );
}
export async function storeDocumentObject(key: string, bytes: Buffer) {
  const path = storageKey(key),
    bucket = process.env.HR_DOCUMENT_BUCKET;
  if (bucket) {
    await getStorage()
      .bucket(bucket)
      .file(path)
      .save(bytes, {
        resumable: false,
        validation: "crc32c",
        metadata: {
          contentType: "application/octet-stream",
          cacheControl: "private, no-store",
        },
        preconditionOpts: { ifGenerationMatch: 0 },
      })
      .catch((e) => {
        if (e.code !== 412) throw e;
      });
    return;
  }
  localAllowed();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(resolve(directory, key), bytes, {
    mode: 0o600,
    flag: "wx",
  }).catch((e) => {
    if (e.code !== "EEXIST") throw e;
  });
}
export async function readDocumentObject(key: string, sha256: string) {
  const path = storageKey(key),
    bucket = process.env.HR_DOCUMENT_BUCKET;
  let data: Buffer;
  if (bucket) [data] = await getStorage().bucket(bucket).file(path).download();
  else {
    localAllowed();
    data = await readFile(resolve(directory, key));
  }
  assert(
    createHash("sha256").update(data).digest("hex") === sha256,
    409,
    "DOCUMENT_INTEGRITY",
    "Không xác minh được toàn vẹn tệp.",
  );
  return data;
}
