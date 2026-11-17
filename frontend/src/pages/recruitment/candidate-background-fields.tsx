import { Select, Textarea } from "../../components/ui";
import type { CustomFieldProps } from "../../components/ui/form";
import { t, useLocale } from "../../i18n";
import {
  BackgroundPresetField,
  BackgroundSkillsField,
} from "../employees/background-fields";
import {
  qualifications,
  studyFields,
  experiencePositions,
} from "../employees/background-options";
import {
  serializeCandidateSummary,
  candidateSummaryDefaults,
  type CandidateSummaryDraft,
  type CandidateSkillsDraft,
  type SummaryKind,
} from "./candidate-background-model";

export function CandidateSummaryField({
  kind,
  ...field
}: CustomFieldProps & { kind: SummaryKind }) {
  useLocale();
  const draft = field.value as CandidateSummaryDraft;
  const set = (patch: Partial<CandidateSummaryDraft>) =>
    field.onChange({ ...draft, ...patch, changed: true });
  const primaryLabel =
    kind === "education" ? "Bằng cấp / trình độ" : "Vị trí đảm nhiệm";
  const detailLabel =
    kind === "education"
      ? "Trường, thời gian học & thành tích"
      : "Công ty, thời gian & trách nhiệm";
  return (
    <div
      className="candidate-background-editor"
      role="group"
      aria-labelledby={field.labelId}
    >
      <div className="field">
        <label htmlFor={`${field.id}-mode`}>{t("Cách nhập thông tin")}</label>
        <Select
          id={`${field.id}-mode`}
          ref={field.ref}
          disabled={field.disabled}
          value={draft.mode}
          onBlur={field.onBlur}
          aria-describedby={field.describedBy}
          aria-invalid={field.invalid}
          options={[
            { value: "guided", label: t("Chọn từ danh mục") },
            { value: "custom", label: t("Khác — nhập cụ thể") },
          ]}
          onValueChange={(mode) => {
            if (mode === "custom") {
              // Keep every field when switching the entire summary to free text.
              set({
                mode,
                custom: serializeCandidateSummary(
                  { ...draft, changed: true },
                  kind,
                ),
              });
            } else {
              // Legacy/custom prose is carried into the details, never replaced.
              const parsed = candidateSummaryDefaults(draft.custom, kind);
              set({
                mode: "guided",
                ...(parsed.mode === "guided"
                  ? {
                      primary: parsed.primary,
                      secondary: parsed.secondary,
                      details: parsed.details,
                    }
                  : { details: draft.custom }),
              });
            }
          }}
        />
      </div>
      {draft.mode === "custom" ? (
        <div className="field">
          <label htmlFor={`${field.id}-custom`}>{t("Nội dung hồ sơ")}</label>
          <Textarea
            id={`${field.id}-custom`}
            value={draft.custom}
            rows={4}
            aria-required
            aria-invalid={field.invalid}
            aria-describedby={field.describedBy}
            disabled={field.disabled}
            onBlur={field.onBlur}
            onChange={(event) => set({ custom: event.target.value })}
          />
          <small>
            {t(
              "Nội dung đã có được giữ nguyên. Bạn có thể bổ sung lựa chọn từ danh mục.",
            )}
          </small>
        </div>
      ) : (
        <>
          <div className="candidate-background-options">
            <div className="field">
              <label id={`${field.id}-primary-label`}>
                {t(primaryLabel)} <span className="field-required">*</span>
              </label>
              <BackgroundPresetField
                {...field}
                id={`${field.id}-primary`}
                labelId={`${field.id}-primary-label`}
                ref={null}
                value={draft.primary}
                onChange={(value) => set({ primary: String(value) })}
                options={
                  kind === "education" ? qualifications : experiencePositions
                }
                required
              />
            </div>
            {kind === "education" && (
              <div className="field">
                <label id={`${field.id}-secondary-label`}>
                  {t("Chuyên ngành")}
                </label>
                <BackgroundPresetField
                  {...field}
                  id={`${field.id}-secondary`}
                  labelId={`${field.id}-secondary-label`}
                  ref={null}
                  value={draft.secondary}
                  onChange={(value) => set({ secondary: String(value) })}
                  options={studyFields}
                />
              </div>
            )}
          </div>
          <div className="field">
            <label htmlFor={`${field.id}-details`}>{t(detailLabel)}</label>
            <Textarea
              id={`${field.id}-details`}
              value={draft.details}
              rows={3}
              disabled={field.disabled}
              onBlur={field.onBlur}
              aria-describedby={field.describedBy}
              onChange={(event) => set({ details: event.target.value })}
            />
          </div>
        </>
      )}
    </div>
  );
}

export function CandidateSkillsField(field: CustomFieldProps) {
  useLocale();
  const draft = field.value as CandidateSkillsDraft;
  const set = (patch: Partial<CandidateSkillsDraft>) =>
    field.onChange({ ...draft, ...patch, changed: true });
  return (
    <div className="candidate-background-editor">
      <BackgroundSkillsField
        {...field}
        value={draft.selected}
        onChange={(selected) => set({ selected: selected as string[] })}
        includeCertificates
      />
      <div className="field">
        <label htmlFor={`${field.id}-details`}>
          {t("Thông tin bổ sung / nội dung đã có")}
        </label>
        <Textarea
          id={`${field.id}-details`}
          value={draft.details}
          placeholder={t(
            "Ví dụ: IELTS 6.5, năm cấp, đơn vị cấp hoặc nghiệp vụ cụ thể",
          )}
          rows={3}
          disabled={field.disabled}
          onBlur={field.onBlur}
          onChange={(event) => set({ details: event.target.value })}
          aria-describedby={field.describedBy}
          aria-invalid={field.invalid}
        />
        <small>
          {t(
            "Giữ nguyên nội dung cũ; bổ sung điểm số, đơn vị cấp hoặc mô tả khi cần.",
          )}
        </small>
      </div>
    </div>
  );
}
