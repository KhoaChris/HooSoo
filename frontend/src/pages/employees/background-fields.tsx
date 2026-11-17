import { useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import type { CustomFieldProps } from "../../components/ui/form";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Button } from "../../components/ui/button";
import { t, useLocale } from "../../i18n";
import "../../style/pages/employee-background.css";
import {
  certificateNames,
  presetLabel,
  searchKey,
  skillGroups,
  skillOptions,
} from "./background-options";

export function BackgroundPresetField({
  options,
  required,
  ...field
}: CustomFieldProps & {
  options: readonly string[];
  required?: boolean;
}) {
  useLocale();
  const value = String(field.value ?? "");
  const [custom, setCustom] = useState(!!value && !options.includes(value));
  const [customDraft, setCustomDraft] = useState(custom ? value : "");
  return (
    <div className="background-preset-field">
      <Select
        id={field.id}
        ref={field.ref}
        aria-labelledby={field.labelId}
        aria-describedby={field.describedBy}
        aria-invalid={field.invalid}
        aria-required={required}
        disabled={field.disabled}
        onBlur={field.onBlur}
        value={custom ? "__custom__" : value}
        options={[
          { value: "", label: t("Chọn một mục"), disabled: required },
          ...options.map((value) => ({ value, label: t(value) })),
          { value: "__custom__", label: t("Khác — nhập cụ thể") },
        ]}
        onValueChange={(next) => {
          setCustom(next === "__custom__");
          field.onChange(next === "__custom__" ? customDraft : next);
        }}
      />
      {custom && (
        <div className="background-custom-value">
          <label id={`${field.id}-custom-label`} htmlFor={`${field.id}-custom`}>
            {t("Nhập nội dung khác")}
          </label>
          <Input
            id={`${field.id}-custom`}
            aria-labelledby={`${field.labelId} ${field.id}-custom-label`}
            aria-describedby={field.describedBy}
            aria-invalid={field.invalid}
            aria-required={required}
            autoFocus
            maxLength={150}
            value={value}
            disabled={field.disabled}
            onBlur={field.onBlur}
            onChange={(event) => {
              setCustomDraft(event.target.value);
              field.onChange(event.target.value);
            }}
          />
        </div>
      )}
    </div>
  );
}

export function BackgroundSkillsField({
  includeCertificates = false,
  ...field
}: CustomFieldProps & { includeCertificates?: boolean }) {
  useLocale();
  const groups = includeCertificates
    ? [...skillGroups, { label: "Chứng chỉ", items: certificateNames }]
    : skillGroups;
  const options = includeCertificates
    ? [...skillOptions, ...certificateNames]
    : skillOptions;
  const values = (Array.isArray(field.value) ? field.value : []) as string[];
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState(skillGroups[0].label);
  const query = searchKey(search);
  const matches = (value: string) =>
    [value, presetLabel(value, options)].some((text) =>
      searchKey(text).includes(query),
    );
  const equivalent = (a: string, b: string) =>
    searchKey(a) === searchKey(b) ||
    searchKey(presetLabel(a, options)) === searchKey(b);
  const selected = (value: string) =>
    values.some((item) => equivalent(value, item) || equivalent(item, value));
  // Search across every group, even if a category filter was selected first.
  const visibleGroups = groups.filter(
    (item) => query || !group || item.label === group,
  );
  const known = options.some((item) => equivalent(item, search));
  const duplicate = values.some((item) => equivalent(item, search));
  const canAdd = !!query && !known && !duplicate && values.length < 30;
  const toggle = (value: string) =>
    field.onChange(
      selected(value)
        ? values.filter(
            (item) => !equivalent(item, value) && !equivalent(value, item),
          )
        : [...values, value],
    );
  const addCustom = () => {
    if (field.disabled || !canAdd) return;
    field.onChange([...values, search.trim()]);
    setSearch("");
    field.onBlur();
  };
  return (
    <div
      className="background-skills-picker"
      role="group"
      aria-labelledby={field.labelId}
      aria-describedby={field.describedBy}
      aria-invalid={field.invalid}
    >
      <div className="background-skills-summary" aria-live="polite">
        <span>
          {t(
            includeCertificates
              ? "Đã chọn {0}/30 kỹ năng & chứng chỉ"
              : "Đã chọn {0}/30 kỹ năng",
            [String(values.length)],
          )}
        </span>
      </div>
      {values.length > 0 && (
        <ul className="background-selected-skills">
          {values.map((value) => (
            <li key={value}>
              <span>{presetLabel(value, options)}</span>
              <button
                type="button"
                disabled={field.disabled}
                onBlur={field.onBlur}
                aria-label={t("Bỏ chọn {0}", [presetLabel(value, options)])}
                onClick={() =>
                  field.onChange(values.filter((item) => item !== value))
                }
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="background-skill-filters">
        <Select
          id={field.id}
          ref={field.ref}
          aria-label={t(
            includeCertificates ? "Nhóm kỹ năng & chứng chỉ" : "Nhóm kỹ năng",
          )}
          disabled={field.disabled}
          value={group}
          onValueChange={setGroup}
          onBlur={field.onBlur}
          options={[
            {
              value: "",
              label: t(
                includeCertificates
                  ? "Tất cả nhóm kỹ năng & chứng chỉ"
                  : "Tất cả nhóm kỹ năng",
              ),
            },
            ...groups.map((item) => ({
              value: item.label,
              label: t(item.label),
            })),
          ]}
        />
        <div className="background-skill-search">
          <Search size={16} aria-hidden="true" />
          <Input
            aria-label={t(
              includeCertificates
                ? "Tìm hoặc thêm kỹ năng, chứng chỉ"
                : "Tìm hoặc thêm kỹ năng",
            )}
            placeholder={t(
              includeCertificates
                ? "Tìm hoặc thêm kỹ năng, chứng chỉ"
                : "Tìm hoặc thêm kỹ năng",
            )}
            value={search}
            maxLength={80}
            disabled={field.disabled}
            onBlur={field.onBlur}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                addCustom();
              }
            }}
          />
        </div>
      </div>
      {canAdd && (
        <Button
          type="button"
          variant="secondary"
          disabled={field.disabled}
          onClick={addCustom}
        >
          <Plus size={16} aria-hidden="true" />
          {t(
            includeCertificates ? "Thêm mục khác “{0}”" : "Thêm kỹ năng “{0}”",
            [search.trim()],
          )}
        </Button>
      )}
      {duplicate && query && (
        <p className="background-picker-hint" role="status">
          {t(
            includeCertificates
              ? "Mục này đã được chọn"
              : "Kỹ năng này đã được chọn",
          )}
        </p>
      )}
      {values.length >= 30 && (
        <p className="background-picker-hint" role="status">
          {t(
            includeCertificates
              ? "Đã đủ 30 mục. Bỏ chọn một mục để thêm mới."
              : "Đã đủ 30 kỹ năng. Bỏ chọn một mục để thêm mới.",
          )}
        </p>
      )}
      <div className="background-skill-options">
        {visibleGroups.map((item) => {
          const items = item.items.filter(matches);
          return (
            items.length > 0 && (
              <fieldset key={item.label}>
                <legend>{t(item.label)}</legend>
                <div>
                  {items.map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={selected(value)}
                      onBlur={field.onBlur}
                      disabled={
                        field.disabled ||
                        (values.length >= 30 && !selected(value))
                      }
                      onClick={() => toggle(value)}
                    >
                      <span
                        className="background-skill-check"
                        aria-hidden="true"
                      >
                        {selected(value) && <Check size={13} />}
                      </span>
                      {t(value)}
                    </button>
                  ))}
                </div>
              </fieldset>
            )
          );
        })}
      </div>
    </div>
  );
}
