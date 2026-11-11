import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";

type TooltipProps = {
  content: string;
  disabled?: boolean;
  children: ReactElement<{ "aria-describedby"?: string }>;
};

/** Portals keep labels visible outside scrollable navigation and table regions. */
export function Tooltip({ content, disabled = false, children }: TooltipProps) {
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const visible = !disabled && position !== null;
  const cancelTimer = () => clearTimeout(timer.current);
  const hide = () => {
    cancelTimer();
    setPosition(null);
  };
  const show = (delay = 120) => {
    cancelTimer();
    if (disabled) return;
    timer.current = setTimeout(() => {
      const rect = anchor.current?.getBoundingClientRect();
      if (rect)
        setPosition({
          left: rect.right + 10,
          top: Math.max(
            24,
            Math.min(window.innerHeight - 24, rect.top + rect.height / 2),
          ),
        });
    }, delay);
  };
  const hideSoon = () => {
    cancelTimer();
    timer.current = setTimeout(hide, 100);
  };

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (disabled) {
      clearTimeout(timer.current);
      setPosition(null);
    }
  }, [disabled]);
  useEffect(() => {
    if (!visible) return;
    const dismiss = () => setPosition(null);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    window.addEventListener("keydown", keydown);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("keydown", keydown);
    };
  }, [visible]);

  return (
    <span
      className="tooltip-anchor"
      ref={anchor}
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") show();
      }}
      onPointerLeave={hideSoon}
      onFocus={() => show(0)}
      onBlur={hide}
      onClick={hide}
    >
      {cloneElement(children, {
        "aria-describedby":
          [children.props["aria-describedby"], visible ? id : null]
            .filter(Boolean)
            .join(" ") || undefined,
      })}
      {visible &&
        createPortal(
          <span
            className="tooltip"
            role="tooltip"
            id={id}
            style={position}
            onPointerEnter={cancelTimer}
            onPointerLeave={hideSoon}
          >
            {content}
          </span>,
          document.body,
        )}
    </span>
  );
}
