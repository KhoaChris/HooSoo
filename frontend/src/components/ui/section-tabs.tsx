import { useRef, type ReactNode } from "react";
import { FolderTree } from "lucide-react";

export type SectionTab<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
  count?: number;
  disabled?: boolean;
};

/** A static group caption followed by keyboard-operable content tabs. */
export function SectionTabs<T extends string>({
  id,
  label,
  items,
  value,
  onChange,
}: {
  id: string;
  label: string;
  items: readonly SectionTab<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const buttons = useRef(new Map<T, HTMLButtonElement>());
  return (
    <div className="section-tabs">
      <div className="section-tabs-label" id={`${id}-label`}>
        <FolderTree size={15} aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div
        className="section-tabs-list"
        role="tablist"
        aria-labelledby={`${id}-label`}
      >
        {items.map((item) => (
          <button
            key={item.value}
            ref={(element) => {
              if (element) buttons.current.set(item.value, element);
              else buttons.current.delete(item.value);
            }}
            type="button"
            role="tab"
            id={`${id}-${item.value}-tab`}
            aria-controls={`${id}-${item.value}-panel`}
            aria-selected={value === item.value}
            tabIndex={value === item.value ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => {
              if (
                event.altKey ||
                event.ctrlKey ||
                event.metaKey ||
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const enabled = items.filter((tab) => !tab.disabled);
              if (!enabled.length) return;
              const index = enabled.findIndex(
                (tab) => tab.value === item.value,
              );
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? enabled.length - 1
                    : (index +
                        (event.key === "ArrowRight" ? 1 : -1) +
                        enabled.length) %
                      enabled.length;
              onChange(enabled[next].value);
              buttons.current.get(enabled[next].value)?.focus();
            }}
          >
            {item.icon && (
              <span className="section-tab-icon" aria-hidden="true">
                {item.icon}
              </span>
            )}
            <span className="section-tab-text">{item.label}</span>
            {item.count !== undefined && (
              <span className="section-tab-count">{item.count}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SectionTabPanel({
  id,
  value,
  active,
  className = "",
  children,
  unlabelled = false,
}: {
  id: string;
  value: string;
  active: string;
  className?: string;
  children: ReactNode;
  unlabelled?: boolean;
}) {
  return (
    <div
      role={unlabelled ? undefined : "tabpanel"}
      id={`${id}-${value}-panel`}
      aria-labelledby={unlabelled ? undefined : `${id}-${value}-tab`}
      tabIndex={unlabelled ? undefined : 0}
      hidden={value !== active}
      className={`section-tab-panel ${className}`.trim()}
    >
      {value === active ? children : null}
    </div>
  );
}
