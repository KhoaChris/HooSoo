import { Textarea } from "./textarea";
import { Checkbox } from "./checkbox";
import { Input } from "./input";
import { useId, useState } from "react";
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

export type FormField = {
  name: string;
  label: string;
  type?:
    | "text"
    | "email"
    | "password"
    | "date"
    | "datetime-local"
    | "number"
    | "textarea"
    | "select"
    | "checkbox";
  options?: SelectOption[];
  hint?: string;
  disabled?: boolean;
};

export function Form({
  schema,
  fields,
  defaults = {},
  onSubmit,
  submitLabel = "Lưu thay đổi",
  onCancel,
}: {
  schema: z.ZodType;
  fields: FormField[];
  defaults?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => Promise<unknown>;
  submitLabel?: string;
  onCancel?: () => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: defaults,
    resolver: zodResolver(
      schema as z.ZodType<FieldValues, FieldValues>,
    ) as Resolver<FieldValues>,
  });
  const [error, setFailure] = useState<Error | null>(null);
  const formId = useId();
  return (
    <form
      className="form"
      onSubmit={handleSubmit(async (data) => {
        setFailure(null);
        try {
          await onSubmit(data);
        } catch (e) {
          const err = e as Error;
          setFailure(err);
          if (err instanceof ApiError)
            for (const [name, messages] of Object.entries(err.fieldErrors))
              setError(name, { message: messages.join(" ") });
        }
      })}
      noValidate
    >
      <ErrorBox error={error} />
      {fields.map((f) => (
        <div
          key={f.name}
          className={"field " + (f.type === "checkbox" ? "checkbox-field" : "")}
        >
          <label htmlFor={`${formId}-${f.name}`}>{f.label}</label>
          {f.type === "select" ? (
            <Controller
              name={f.name}
              control={control}
              defaultValue={defaults[f.name] ?? f.options?.[0]?.value ?? ""}
              render={({ field }) => (
                <Select
                  id={`${formId}-${f.name}`}
                  aria-label={f.label}
                  aria-invalid={!!errors[f.name]}
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
              rows={3}
              {...register(f.name)}
            />
          ) : f.type === "checkbox" ? (
            <Checkbox
              id={`${formId}-${f.name}`}
              aria-label={f.label}
              {...register(f.name)}
              disabled={f.disabled}
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
              {...register(
                f.name,
                f.type === "number" ? { valueAsNumber: true } : {},
              )}
              disabled={f.disabled}
              autoComplete={f.type === "password" ? "new-password" : undefined}
            />
          )}{" "}
          {f.hint && <small id={`${formId}-${f.name}-hint`}>{f.hint}</small>}
          {errors[f.name] && (
            <small id={`${formId}-${f.name}-error`} className="field-error">
              {String(errors[f.name]?.message || "Thông tin không hợp lệ")}
            </small>
          )}
        </div>
      ))}
      <div className="form-actions">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Hủy
          </Button>
        )}
        <Button type="submit" busy={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
