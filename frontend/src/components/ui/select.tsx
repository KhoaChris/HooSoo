import { useRef, useState, type ComponentProps, type Ref } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectProps = Pick<
  ComponentProps<typeof SelectPrimitive.Trigger>,
  | "id"
  | "aria-label"
  | "aria-labelledby"
  | "aria-describedby"
  | "aria-invalid"
  | "onBlur"
  | "className"
> & {
  options: readonly SelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  ref?: Ref<HTMLButtonElement>;
};

// Encode every value so the app's empty/all/none option remains selectable.
// Radix reserves its own empty string for an unselected placeholder.
const encode = (value: string) => `option:${value}`;

export function Select({
  options,
  value,
  onValueChange,
  disabled,
  placeholder = "Chọn một mục",
  className = "",
  ref,
  ...props
}: SelectProps) {
  const trigger = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [container, setContainer] = useState<HTMLElement | undefined>();
  const selected = options.some((option) => option.value === value);

  return (
    <SelectPrimitive.Root
      open={open}
      value={selected ? encode(value) : ""}
      onValueChange={(next) => onValueChange(next.slice("option:".length))}
      disabled={disabled || options.length === 0}
      onOpenChange={(open) => {
        // Native dialogs make body portals inert; keep the menu in that dialog.
        if (open) setContainer(trigger.current?.closest("dialog") ?? undefined);
        setOpen(open);
      }}
    >
      <SelectPrimitive.Trigger
        {...props}
        ref={(node) => {
          trigger.current = node;
          if (typeof ref === "function") return ref(node);
          if (ref) ref.current = node;
        }}
        className={`select-trigger ${className}`}
      >
        <SelectPrimitive.Value
          placeholder={options.length ? placeholder : "Chưa có lựa chọn"}
        />
        <SelectPrimitive.Icon className="select-chevron">
          <ChevronDown size={16} aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal container={container}>
        <SelectPrimitive.Content
          className="select-content"
          position="popper"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          // Esc closes only this menu, not the surrounding native dialog.
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            setOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") event.stopPropagation();
          }}
        >
          <SelectPrimitive.ScrollUpButton className="select-scroll-button">
            <ChevronUp size={15} aria-hidden="true" />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="select-viewport">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={encode(option.value)}
                disabled={option.disabled}
                className="select-option"
                textValue={option.label}
              >
                <SelectPrimitive.ItemText>
                  {option.label}
                </SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="select-check">
                  <Check size={16} strokeWidth={2.25} aria-hidden="true" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="select-scroll-button">
            <ChevronDown size={15} aria-hidden="true" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
