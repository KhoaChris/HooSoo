import { t, useLocale } from "../../i18n";
import { Textarea } from "./textarea";
import { Checkbox } from "./checkbox";
import { Input } from "./input";
import { DateTimePicker } from "./date-time-picker";
import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import {
  Controller,
  useForm,
  type Resolver,
  type FieldValues,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ApiError } from "../../services/api-client";
import { Select, type SelectOption } from "./select";
import { Button, type ButtonTone } from "./button";
import { ErrorBox } from "./error-box";
import { useModalForm } from "./modal";
import { StableText } from "../../i18n/stable-text";

export type CustomFieldProps = {
  id: string;
  labelId: string;
  value: unknown;
  onChange: (value: unknown) => void;
  onBlur: () => void;
  ref: Ref<HTMLButtonElement>;
  disabled: boolean;
  invalid: boolean;
  describedBy?: string;
};

export type FormField = {
  name: string;
  label: string;
  type?:
    | "text"
    | "email"
    | "password"
    | "date"
    | "time"
    | "datetime-local"
    | "number"
    | "textarea"
    | "select"
    | "choices"
    | "checkbox";
  options?: SelectOption[];
  hint?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  min?: string;
  max?: string;
  section?: string;
  span?: "full";
  render?: (props: CustomFieldProps) => ReactNode;
};

export function Form({
  schema,
  fields,
  defaults = {},
  onSubmit,
  submitLabel = t("Lưu thay đổi"),
  submitTone,
  onCancel,
  columns = 1,
  resetAfterSubmit = true,
}: {
  schema: z.ZodType;
  fields: FormField[];
  defaults?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => Promise<unknown>;
  submitLabel?: string;
  submitTone?: ButtonTone;
  onCancel?: () => void;
  columns?: 1 | 2;
  resetAfterSubmit?: boolean;
}) {
  useLocale();
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    getValues,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    defaultValues: defaults,
    resolver: zodResolver(
      schema as z.ZodType<FieldValues, FieldValues>,
    ) as Resolver<FieldValues>,
  });
  const [error, setFailure] = useState<Error | null>(null);
  const formId = useId();
  const modal = useModalForm();
  const reportStatus = modal?.setFormStatus;
  const submitting = useRef(false);
  useEffect(() => {
    reportStatus?.({ dirty: isDirty, busy: isSubmitting });
  }, [isDirty, isSubmitting, reportStatus]);
  useEffect(
    () => () => {
      reportStatus?.({ dirty: false, busy: false });
    },
    [reportStatus],
  );
  useEffect(() => {
    if (!isDirty) return;
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventUnload);
    return () => window.removeEventListener("beforeunload", preventUnload);
  }, [isDirty]);
  return (
    <form
      className={`form form-columns-${columns}`}
      aria-busy={isSubmitting}
      onSubmit={(event) => {
        event.preventDefault();
        if (submitting.current) return;
        submitting.current = true;
        void handleSubmit(async (data) => {
          setFailure(null);
          try {
            await onSubmit(data);
            if (resetAfterSubmit) reset(getValues());
          } catch (e) {
            const err = e as Error;
            setFailure(err);
            if (err instanceof ApiError)
              for (const [name, messages] of Object.entries(err.fieldErrors))
                setError(name, { message: messages.join(" ") });
          }
        })(event).finally(() => {
          submitting.current = false;
        });
      }}
      noValidate
    >
      <ErrorBox error={error} />
      {Object.keys(errors).length > 0 && (
        <p className="form-validation" role="alert">
          {Object.entries(errors)
            .filter(([name]) => !fields.some((field) => field.name === name))
            .map(([, issue]) =>
              typeof issue?.message === "string" ? issue.message : "",
            )
            .filter(Boolean)
            .join(". ") ||
            t("Vui lòng kiểm tra các thông tin được đánh dấu bên dưới.")}
        </p>
      )}
      {fields.map((f) => (
        <Fragment key={f.name}>
          {f.section && (
            <h3 className="form-section">
              <StableText>{t(f.section)}</StableText>
            </h3>
          )}
          <div
            className={
              "field " +
              (f.type === "checkbox" ? "checkbox-field " : "") +
              (f.span === "full" ? "field-full" : "")
            }
          >
            <label
              id={`${formId}-${f.name}-label`}
              htmlFor={
                f.render || f.type === "choices"
                  ? undefined
                  : `${formId}-${f.name}`
              }
            >
              <StableText
                after={
                  f.required && (
                    <span className="field-required" aria-hidden="true">
                      {" "}
                      *
                    </span>
                  )
                }
              >
                {t(f.label)}
              </StableText>
            </label>
            {f.render ? (
              <Controller
                name={f.name}
                control={control}
                render={({ field }) => (
                  <>
                    {f.render!({
                      id: `${formId}-${f.name}`,
                      labelId: `${formId}-${f.name}-label`,
                      value: field.value,
                      onChange: field.onChange,
                      onBlur: field.onBlur,
                      ref: field.ref,
                      disabled: !!f.disabled || isSubmitting,
                      invalid: !!errors[f.name],
                      describedBy: errors[f.name]
                        ? `${formId}-${f.name}-error`
                        : undefined,
                    })}
                  </>
                )}
              />
            ) : f.type === "choices" ? (
              <Controller
                name={f.name}
                control={control}
                render={({ field }) => {
                  const selected = Array.isArray(field.value)
                    ? (field.value as string[])
                    : [];
                  return (
                    <div
                      className="choice-group"
                      role="group"
                      aria-labelledby={`${formId}-${f.name}-label`}
                      aria-describedby={
                        errors[f.name]
                          ? `${formId}-${f.name}-error`
                          : f.hint
                            ? `${formId}-${f.name}-hint`
                            : undefined
                      }
                    >
                      {f.options?.map((option, index) => (
                        <button
                          key={option.value}
                          type="button"
                          ref={index === 0 ? field.ref : undefined}
                          aria-pressed={selected.includes(option.value)}
                          disabled={
                            f.disabled || isSubmitting || option.disabled
                          }
                          onBlur={field.onBlur}
                          onClick={() =>
                            field.onChange(
                              selected.includes(option.value)
                                ? selected.filter(
                                    (value) => value !== option.value,
                                  )
                                : [...selected, option.value],
                            )
                          }
                        >
                          {t(option.label)}
                        </button>
                      ))}
                    </div>
                  );
                }}
              />
            ) : f.type === "select" ? (
              <Controller
                name={f.name}
                control={control}
                defaultValue={defaults[f.name] ?? f.options?.[0]?.value ?? ""}
                render={({ field }) => (
                  <Select
                    id={`${formId}-${f.name}`}
                    aria-label={t(f.label)}
                    aria-invalid={!!errors[f.name]}
                    aria-required={f.required}
                    aria-describedby={
                      [
                        f.hint && `${formId}-${f.name}-hint`,
                        errors[f.name] && `${formId}-${f.name}-error`,
                      ]
                        .filter(Boolean)
                        .join(" ") || undefined
                    }
                    ref={field.ref}
                    value={String(field.value ?? "")}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    options={f.options ?? []}
                    disabled={f.disabled || isSubmitting}
                  />
                )}
              />
            ) : f.type === "date" ||
              f.type === "time" ||
              f.type === "datetime-local" ? (
              <Controller
                name={f.name}
                control={control}
                defaultValue={defaults[f.name] ?? ""}
                render={({ field }) => (
                  <DateTimePicker
                    type={f.type as "date" | "time" | "datetime-local"}
                    id={`${formId}-${f.name}`}
                    name={field.name}
                    aria-label={t(f.label)}
                    aria-invalid={!!errors[f.name]}
                    aria-required={f.required}
                    aria-describedby={
                      [
                        f.hint && `${formId}-${f.name}-hint`,
                        errors[f.name] && `${formId}-${f.name}-error`,
                      ]
                        .filter(Boolean)
                        .join(" ") || undefined
                    }
                    ref={field.ref}
                    value={String(field.value ?? "")}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder={f.placeholder}
                    min={f.min}
                    max={f.max}
                    disabled={f.disabled || isSubmitting}
                  />
                )}
              />
            ) : f.type === "textarea" ? (
              <Textarea
                aria-invalid={!!errors[f.name]}
                aria-describedby={
                  [
                    f.hint && `${formId}-${f.name}-hint`,
                    errors[f.name] && `${formId}-${f.name}-error`,
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
                id={`${formId}-${f.name}`}
                aria-label={t(f.label)}
                placeholder={f.placeholder}
                disabled={f.disabled || isSubmitting}
                aria-required={f.required}
                rows={3}
                {...register(f.name)}
              />
            ) : f.type === "checkbox" ? (
              <Checkbox
                id={`${formId}-${f.name}`}
                aria-label={t(f.label)}
                {...register(f.name)}
                disabled={f.disabled || isSubmitting}
              />
            ) : (
              <Input
                aria-invalid={!!errors[f.name]}
                aria-describedby={
                  [
                    f.hint && `${formId}-${f.name}-hint`,
                    errors[f.name] && `${formId}-${f.name}-error`,
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
                id={`${formId}-${f.name}`}
                aria-label={t(f.label)}
                type={f.type || "text"}
                placeholder={f.placeholder}
                aria-required={f.required}
                {...register(
                  f.name,
                  f.type === "number" ? { valueAsNumber: true } : {},
                )}
                disabled={f.disabled || isSubmitting}
                autoComplete={
                  f.type === "password" ? "new-password" : undefined
                }
              />
            )}{" "}
            {f.hint && (
              <small id={`${formId}-${f.name}-hint`}>
                <StableText>{t(f.hint)}</StableText>
              </small>
            )}
            {errors[f.name] && (
              <small id={`${formId}-${f.name}-error`} className="field-error">
                {f.required && !getValues(f.name)
                  ? t("Vui lòng {0} {1}.", [
                      f.type === "select" || f.type === "date"
                        ? t("chọn")
                        : t("nhập"),
                      t(f.label).toLocaleLowerCase(),
                    ])
                  : t(
                      String(
                        errors[f.name]?.message || t("Thông tin không hợp lệ"),
                      ),
                    )}
              </small>
            )}
          </div>
        </Fragment>
      ))}
      <div className="form-actions">
        {(onCancel || modal) && (
          <Button
            type="button"
            variant="secondary"
            disabled={isSubmitting}
            onClick={modal?.requestClose ?? onCancel}
          >
            {t("Hủy")}
          </Button>
        )}
        <Button type="submit" tone={submitTone} busy={isSubmitting}>
          {isSubmitting ? t("Đang lưu…") : submitLabel}
        </Button>
      </div>
    </form>
  );
}
