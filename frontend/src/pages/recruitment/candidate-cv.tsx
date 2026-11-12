import { useState, useRef, useEffect } from "react";
import { UploadCloud, FileText, Download } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { Candidate } from "@hoosoo/shared";
import { api } from "../../services/api-client";
import { refreshQueries } from "../../services/query-sync";
import { Button, ErrorBox } from "../../components/ui";
import { useModalForm } from "../../components/ui/modal";
export function CandidateCV({
  candidate,
  editable,
  onPendingChange,
}: {
  candidate: Candidate;
  editable: boolean;
  onPendingChange: (pending: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [error, setError] = useState<Error | null>(null),
    [busy, setBusy] = useState(false),
    input = useRef<HTMLInputElement>(null),
    key = useRef(crypto.randomUUID()),
    client = useQueryClient();
  const modal = useModalForm(),
    report = modal?.setFormStatus;
  useEffect(() => {
    report?.({ dirty: !!file, busy });
    return () => report?.({ dirty: false, busy: false });
  }, [file, busy, report]);
  useEffect(() => {
    onPendingChange(!!file || busy);
    return () => onPendingChange(false);
  }, [file, busy, onPendingChange]);
  useEffect(() => {
    if (!file) return;
    const prevent = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [file]);
  const choose = (f?: File) => {
    if (!f) return;
    setError(null);
    if (f.size > 2 * 1024 * 1024 || !f.name.toLowerCase().endsWith(".pdf")) {
      setError(new Error("Chọn tệp PDF tối đa 2 MB."));
      return;
    }
    setFile(f);
    key.current = crypto.randomUUID();
  };
  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const blob = await api<Blob>(
          `/recruitment/candidates/${candidate.id}/cv`,
          { download: true },
        ),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = candidate.cv?.name ?? "CV.pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="candidate-cv">
      <ErrorBox error={error} />
      {candidate.cv ? (
        <div className="cv-current">
          <FileText size={28} />
          <div>
            <strong>{candidate.cv.name}</strong>
            <small>{Math.ceil(candidate.cv.size / 1024)} KB · PDF gốc</small>
          </div>
          <Button
            variant="secondary"
            busy={busy}
            onClick={() => void download()}
          >
            <Download size={16} />
            Tải CV
          </Button>
        </div>
      ) : (
        <p className="workflow-help">
          Chưa có CV đính kèm. Thông tin hồ sơ được ghi nhận ở mục Hồ sơ.
        </p>
      )}
      {editable && (
        <>
          <div
            className="cv-drop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!busy) choose(e.dataTransfer.files[0]);
            }}
          >
            <UploadCloud size={26} />
            <strong>{file?.name ?? "Kéo thả CV vào đây"}</strong>
            <span>PDF tối đa 2 MB · Lưu nguyên bản tài liệu</span>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              Chọn tệp PDF
            </Button>
            <input
              ref={input}
              type="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={(e) => choose(e.target.files?.[0])}
            />
          </div>
          {file && (
            <div className="workflow-actions">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setFile(null)}
              >
                Bỏ tệp
              </Button>
              <Button
                busy={busy}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    await api(`/recruitment/candidates/${candidate.id}/cv`, {
                      method: "POST",
                      file,
                      key: key.current,
                      version: candidate.version,
                    });
                    setFile(null);
                    await refreshQueries(client, ["candidates"]);
                    window.dispatchEvent(new Event("hoosoo:saved"));
                  } catch (e) {
                    setError(e as Error);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Lưu CV vào hồ sơ
              </Button>
            </div>
          )}
          <p className="workflow-help">
            CV được lưu riêng và chỉ tải khi cần. Nội dung hồ sơ có cấu trúc cần
            được nhập và đối chiếu với CV gốc.
          </p>
        </>
      )}
    </section>
  );
}
