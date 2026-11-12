import { Textarea } from "./textarea";
import { Checkbox } from "./checkbox";
import { Input } from "./input";
import { Fragment, useEffect, useId, useRef, useState } from "react";
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
import { Button } from "./button";
import { ErrorBox } from "./error-box";
import { useModalForm } from "./modal";

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
  section?: string;
  span?: "full";
};

export function Form({
  schema,
  fields,
  defaults = {},
  onSubmit,
  submitLabel = "Lưu thay đổi",
  onCancel,
  columns = 1,
  resetAfterSubmit = true,
}: {
  schema: z.ZodType;
  fields: FormField[];
  defaults?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => Promise<unknown>;
  submitLabel?: string;
  onCancel?: () => void;
  columns?: 1 | 2;
  resetAfterSubmit?: boolean;
}) {
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
      {fields.some((field) => field.required) && (
        <p className="form-required-note">
          <span aria-hidden="true">*</span> Thông tin bắt buộc
        </p>
      )}
      {Object.keys(errors).length > 0 && (
        <p className="form-validation" role="alert">
          {Object.entries(errors)
            .filter(([name]) => !fields.some((field) => field.name === name))
            .map(([, issue]) =>
              typeof issue?.message === "string" ? issue.message : "",
            )
            .filter(Boolean)
            .join(". ") ||
            "Vui lòng kiểm tra các thông tin được đánh dấu bên dưới."}
        </p>
      )}
      {fields.map((f) => (
        <Fragment key={f.name}>
          {f.section && <h3 className="form-section">{f.section}</h3>}
          <div
            className={
              "field " +
              (f.type === "checkbox" ? "checkbox-field " : "") +
              (f.span === "full" ? "field-full" : "")
            }
          >
            <label
              id={`${formId}-${f.name}-label`}
              htmlFor={f.type === "choices" ? undefined : `${formId}-${f.name}`}
            >
              {f.label}
              {f.required && (
                <span className="field-required" aria-hidden="true">
                  {" "}
                  *
                </span>
              )}
            </label>
            {f.type === "choices" ? (
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
                          {option.label}
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
                    aria-label={f.label}
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
                aria-label={f.label}
                placeholder={f.placeholder}
                disabled={f.disabled || isSubmitting}
                aria-required={f.required}
                rows={3}
                {...register(f.name)}
              />
            ) : f.type === "checkbox" ? (
              <Checkbox
                id={`${formId}-${f.name}`}
                aria-label={f.label}
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
                aria-label={f.label}
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
            {f.hint && <small id={`${formId}-${f.name}-hint`}>{f.hint}</small>}
            {errors[f.name] && (
              <small id={`${formId}-${f.name}-error`} className="field-error">
                {f.required && !getValues(f.name)
                  ? `Vui lòng ${f.type === "select" || f.type === "date" ? "chọn" : "nhập"} ${f.label.toLocaleLowerCase("vi")}.`
                  : String(errors[f.name]?.message || "Thông tin không hợp lệ")}
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
            Hủy
          </Button>
        )}
        <Button type="submit" busy={isSubmitting}>
          {isSubmitting ? "Đang lưu…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
