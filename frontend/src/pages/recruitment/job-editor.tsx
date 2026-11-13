import { StableText } from "../../i18n/stable-text";
import { t, useLocale } from "../../i18n";
import { useEffect, useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import {
  defaultRecruitmentStages,
  recruitmentJobSchema,
  type RecruitmentJob,
} from "@hoosoo/shared";
import { Input, Textarea, Select, Button, ErrorBox } from "../../components/ui";
import { useModalForm } from "../../components/ui/modal";
import { useAction } from "../../hooks/data";
export interface RecruitmentDirectory {
  items: RecruitmentJob[];
  departments: { id: string; name: string }[];
  reviewers: { id: string; name: string; departmentId: string; hr: boolean }[];
}
export function JobEditor({
  job,
  directory,
  onSaved,
}: {
  job?: RecruitmentJob;
  directory: RecruitmentDirectory;
  onSaved: (id: string) => void;
}) {
  useLocale();
  const [initial] = useState(() => ({
      title: job?.title ?? "",
      description: job?.description ?? "",
      departmentId: job?.departmentId ?? "",
      hiringManagerId: job?.hiringManagerId ?? "",
      openings: job?.openings ?? 1,
      stages: job?.stages ?? defaultRecruitmentStages,
      active: job?.active ?? true,
      version: job?.version ?? 0,
    })),
    [value, setValue] = useState(initial),
    [error, setError] = useState<Error | null>(null);
  const save = useAction(),
    modal = useModalForm(),
    setStatus = modal?.setFormStatus;
  useEffect(() => {
    setStatus?.({
      dirty: JSON.stringify(value) !== JSON.stringify(initial),
      busy: save.isPending,
    });
  }, [value, initial, save.isPending, setStatus]);
  useEffect(() => {
    if (JSON.stringify(value) === JSON.stringify(initial)) return;
    const prevent = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [value, initial]);
  const set = <K extends keyof typeof value>(key: K, v: (typeof value)[K]) =>
    setValue((old) => ({ ...old, [key]: v }));
  return (
    <form
      className="job-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        if (save.isPending) return;
        setError(null);
        const parsed = recruitmentJobSchema.safeParse(value);
        if (!parsed.success) {
          setError(new Error(parsed.error.issues[0].message));
          return;
        }
        try {
          const result = (await save.mutateAsync({
            path: job ? `/recruitment/jobs/${job.id}` : "/recruitment/jobs",
            method: job ? "PATCH" : "POST",
            body: parsed.data,
          })) as RecruitmentJob;
          onSaved(result.id);
        } catch (err) {
          setError(err as Error);
        }
      }}
    >
      <ErrorBox error={error} />
      <div className="job-fields">
        <label>
          <StableText>{t("Vị trí tuyển dụng")}</StableText>
          <Input
            required
            value={value.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder={t("Ví dụ: Chuyên viên nhân sự")}
          />
        </label>
        <label>
          <StableText>{t("Số lượng cần tuyển")}</StableText>
          <Input
            required
            type="number"
            min={1}
            max={100}
            value={value.openings}
            onChange={(e) => set("openings", Number(e.target.value))}
          />
        </label>
        <label>
          <StableText>{t("Phòng ban")}</StableText>
          <Select
            aria-label={t("Phòng ban tuyển dụng")}
            value={value.departmentId}
            onValueChange={(v) =>
              setValue((old) => ({
                ...old,
                departmentId: v,
                hiringManagerId: "",
              }))
            }
            options={[
              { value: "", label: t("Chọn phòng ban") },
              ...directory.departments.map((d) => ({
                value: d.id,
                label: d.name,
              })),
            ]}
          />
        </label>
        <label>
          <StableText>{t("Người phụ trách")}</StableText>
          <Select
            aria-label={t("Người phụ trách tuyển dụng")}
            value={value.hiringManagerId}
            onValueChange={(v) => set("hiringManagerId", v)}
            options={[
              { value: "", label: t("Chọn người phụ trách") },
              ...directory.reviewers
                .filter((r) => r.departmentId === value.departmentId)
                .map((r) => ({ value: r.id, label: r.name })),
            ]}
          />
        </label>
      </div>
      <label className="job-description">
        <StableText>{t("Mô tả & yêu cầu")}</StableText>
        <Textarea
          rows={3}
          value={value.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </label>
      <div className="stage-editor-heading">
        <div>
          <h3>
            <StableText>{t("Quy trình tuyển dụng")}</StableText>
          </h3>
          <p>
            <StableText>
              {t("Các vòng đã có ứng viên được giữ nguyên thứ tự.")}
            </StableText>
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={value.stages.length >= 8}
          onClick={() =>
            set("stages", [
              ...value.stages.slice(0, -1),
              {
                id: crypto.randomUUID(),
                name: t("Phỏng vấn {0}", [value.stages.length - 1]),
                kind: "interview",
              },
              value.stages.at(-1)!,
            ])
          }
        >
          <Plus size={15} />
          {t("Thêm vòng")}
        </Button>
      </div>
      <ol className="stage-editor">
        {value.stages.map((stage, i) => (
          <li key={stage.id}>
            <span>{String(i + 1).padStart(2, "0")}</span>
            <Input
              aria-label={t("Tên vòng {0}", [i + 1])}
              required
              value={stage.name}
              onChange={(e) =>
                set(
                  "stages",
                  value.stages.map((s, n) =>
                    n === i ? { ...s, name: e.target.value } : s,
                  ),
                )
              }
            />
            <small>
              <StableText>
                {stage.kind === "screening"
                  ? t("Sơ tuyển")
                  : stage.kind === "decision"
                    ? t("Quyết định")
                    : t("Phỏng vấn")}
              </StableText>
            </small>
            {stage.kind === "interview" && (
              <div className="row-actions">
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={t("Đưa vòng {0} lên", [i + 1])}
                  disabled={i <= 1}
                  onClick={() => {
                    const list = [...value.stages];
                    [list[i - 1], list[i]] = [list[i], list[i - 1]];
                    set("stages", list);
                  }}
                >
                  <ArrowUp size={15} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={t("Đưa vòng {0} xuống", [i + 1])}
                  disabled={i >= value.stages.length - 2}
                  onClick={() => {
                    const list = [...value.stages];
                    [list[i + 1], list[i]] = [list[i], list[i + 1]];
                    set("stages", list);
                  }}
                >
                  <ArrowDown size={15} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={t("Xóa vòng {0}", [i + 1])}
                  tone="danger"
                  onClick={() =>
                    set(
                      "stages",
                      value.stages.filter((_, n) => n !== i),
                    )
                  }
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ol>
      {job && (
        <label>
          <StableText>{t("Trạng thái đợt tuyển")}</StableText>
          <Select
            aria-label={t("Trạng thái đợt tuyển")}
            value={String(value.active)}
            onValueChange={(v) => set("active", v === "true")}
            options={[
              { value: "true", label: t("Đang tuyển") },
              { value: "false", label: t("Tạm đóng") },
            ]}
          />
        </label>
      )}
      <div className="form-actions">
        <Button
          type="button"
          variant="secondary"
          disabled={save.isPending}
          onClick={modal?.requestClose}
        >
          {t("Hủy")}
        </Button>
        <Button type="submit" busy={save.isPending}>
          {job ? t("Lưu quy trình") : t("Tạo đợt tuyển dụng")}
        </Button>
      </div>
    </form>
  );
}
