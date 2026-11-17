import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, it, expect, vi } from "vitest";
let directory: string;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "hoosoo-documents-"));
  vi.stubEnv("HR_DOCUMENT_DIR", directory);
  vi.stubEnv("HR_DOCUMENT_BUCKET", "");
});
afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});
describe("private document storage", () => {
  it("retains immutable bytes with private permissions and verifies integrity", async () => {
    const { storeDocumentObject, readDocumentObject } =
        await import("../src/modules/workforce/document-storage"),
      bytes = Buffer.from("%PDF-1.7\nImmutable QA file"),
      key = createHash("sha256").update("unique-key").digest("hex"),
      hash = createHash("sha256").update(bytes).digest("hex");
    await storeDocumentObject(key, bytes);
    await storeDocumentObject(key, Buffer.from("different"));
    expect(await readDocumentObject(key, hash)).toEqual(bytes);
    const path = join(directory, "hoosoo-tests", key);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    await writeFile(path, "tampered");
    await expect(readDocumentObject(key, hash)).rejects.toThrow();
    await expect(storeDocumentObject("../outside", bytes)).rejects.toThrow();
  });
});
