import type { CustomFieldProps } from "../../components/ui/form";
export function EmploymentChoice({
  id,
  labelId,
  value,
  onChange,
  onBlur,
  ref,
  disabled,
  invalid,
  describedBy,
  options,
}: CustomFieldProps & { options: { value: string; label: string }[] }) {
  const selected = options.findIndex((option) => option.value === value);
  return (
    <div
      id={id}
      role="radiogroup"
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      aria-invalid={invalid}
      className="employment-choice"
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          disabled={disabled}
          tabIndex={index === Math.max(0, selected) ? 0 : -1}
          ref={index === Math.max(0, selected) ? ref : undefined}
          onBlur={onBlur}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => {
            const direction = ["ArrowRight", "ArrowDown"].includes(event.key)
              ? 1
              : ["ArrowLeft", "ArrowUp"].includes(event.key)
                ? -1
                : 0;
            if (!direction) return;
            event.preventDefault();
            const next = (index + direction + options.length) % options.length;
            onChange(options[next].value);
            const buttons =
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                "button",
              );
            buttons?.[next]?.focus();
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
