import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

export interface CandidateDrag {
  id: string;
  version: number;
  x: number;
  y: number;
  width: number;
  target: string | null;
  keyboard: boolean;
}

/** Pointer capture supports mouse, pen and touch without native drag previews. */
export function useCandidateDrag(options: {
  onLift: (id: string, version: number) => boolean;
  onDrop: (drag: CandidateDrag) => void;
  onCancel: () => void;
}) {
  const board = useRef<HTMLDivElement>(null);
  const callbacks = useRef(options);
  callbacks.current = options;
  const [drag, setDrag] = useState<CandidateDrag | null>(null);
  const current = useRef<CandidateDrag | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  const suppressClick = useRef(false);
  const publish = (value: CandidateDrag | null) => {
    current.current = value;
    setDrag(value);
  };
  const finish = (drop: boolean) => {
    const last = current.current;
    cleanup.current?.();
    cleanup.current = null;
    publish(null);
    if (last) {
      if (drop) callbacks.current.onDrop(last);
      else callbacks.current.onCancel();
    }
  };
  useEffect(() => () => cleanup.current?.(), []);
  const targetAt = (x: number, y: number) => {
    const element = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>("[data-stage-id]");
    return element && board.current?.contains(element)
      ? (element.dataset.stageId ?? null)
      : null;
  };
  const start = (
    event: ReactPointerEvent<HTMLElement>,
    id: string,
    version: number,
  ) => {
    if (!event.isPrimary || event.button !== 0 || current.current) return;
    const target = event.target as HTMLElement;
    if (
      target.closest(
        "button:not(.candidate-open):not(.candidate-drag-handle):not(.candidate-drag-lock), a, input",
      )
    )
      return;
    // Touch scrolling works on the card; its dedicated handle owns touch dragging.
    if (
      event.pointerType === "touch" &&
      !target.closest(".candidate-drag-handle, .candidate-drag-lock")
    )
      return;
    cleanup.current?.();
    suppressClick.current = false;
    const element = event.currentTarget,
      pointerId = event.pointerId;
    const rect = element.getBoundingClientRect();
    const origin = { x: event.clientX, y: event.clientY };
    let point = origin,
      frame = 0,
      lastFrame = 0,
      blocked = false,
      active = false;
    const activate = () => {
      if (active || blocked) return;
      suppressClick.current = true;
      element.setPointerCapture(pointerId);
      if (!callbacks.current.onLift(id, version)) {
        blocked = true;
        return;
      }
      active = true;
      document.body.classList.add("candidate-dragging");
      publish({
        id,
        version,
        ...point,
        width: rect.width,
        target: targetAt(point.x, point.y),
        keyboard: false,
      });
      frame = requestAnimationFrame(scroll);
    };
    const scroll = (time: number) => {
      const container = board.current;
      if (!active || !container) return;
      const elapsed = lastFrame ? Math.min(time - lastFrame, 32) : 0;
      lastFrame = time;
      const box = container.getBoundingClientRect();
      const edge = 56;
      const dx =
        point.x < box.left + edge
          ? -(1 - (point.x - box.left) / edge)
          : point.x > box.right - edge
            ? 1 - (box.right - point.x) / edge
            : 0;
      if (
        dx &&
        point.y >= box.top &&
        point.y <= box.bottom &&
        point.x >= box.left &&
        point.x <= box.right
      ) {
        const previous = container.scrollLeft;
        container.scrollLeft += dx * elapsed * 0.48;
        if (current.current && previous !== container.scrollLeft)
          publish({ ...current.current, target: targetAt(point.x, point.y) });
      }
      frame = requestAnimationFrame(scroll);
    };
    const timer = window.setTimeout(activate, 200);
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      point = { x: e.clientX, y: e.clientY };
      if (
        !active &&
        !blocked &&
        Math.hypot(point.x - origin.x, point.y - origin.y) > 6
      ) {
        if (e.pointerType === "touch") {
          finish(false);
          return;
        }
        activate();
      }
      if (blocked) e.preventDefault();
      if (active) {
        e.preventDefault();
        publish({
          ...current.current!,
          ...point,
          target: targetAt(point.x, point.y),
        });
      }
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      if (active && current.current)
        current.current.target = targetAt(e.clientX, e.clientY);
      finish(true);
    };
    const cancel = () => finish(false);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", key);
    cleanup.current = () => {
      active = false;
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", key);
      if (element.hasPointerCapture(pointerId))
        element.releasePointerCapture(pointerId);
      document.body.classList.remove("candidate-dragging");
    };
  };
  return {
    board,
    drag,
    start,
    cancel: () => finish(false),
    consumeClick: () => {
      const suppressed = suppressClick.current;
      suppressClick.current = false;
      return suppressed;
    },
    keyboard(
      id: string,
      version: number,
      key: string,
      target: string,
      element: HTMLElement,
    ) {
      if (key === "Escape") {
        finish(false);
        return;
      }
      if (!current.current && [" ", "Enter"].includes(key)) {
        if (!callbacks.current.onLift(id, version)) return;
        const rect = element.getBoundingClientRect();
        publish({
          id,
          version,
          x: rect.left,
          y: rect.top,
          width: rect.width,
          target: null,
          keyboard: true,
        });
      } else if (current.current?.keyboard && current.current.id === id) {
        if (key === "ArrowRight") {
          publish({ ...current.current, target });
          Array.from(
            board.current!.querySelectorAll<HTMLElement>("[data-stage-id]"),
          )
            .find((e) => e.dataset.stageId === target)
            ?.scrollIntoView({ block: "nearest", inline: "nearest" });
        } else if (key === "ArrowLeft")
          publish({ ...current.current, target: null });
        else if (["Enter", " "].includes(key)) finish(true);
      }
    },
  };
}
