import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { X, TriangleAlert } from "lucide-react";
import { Button } from "./button";

type FormStatus = { dirty: boolean; busy: boolean };
const ModalContext = createContext<{
  requestClose: () => void;
  setFormStatus: (status: FormStatus) => void;
} | null>(null);
export const useModalForm = () => useContext(ModalContext);

export function Modal({
  title,
  description,
  icon,
  size = "medium",
  onClose,
  children,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  size?: "medium" | "wide";
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const previousField = useRef<HTMLElement | null>(null);
  const backdropDown = useRef(false);
  const id = useId();
  const [status, setFormStatus] = useState<FormStatus>({
    dirty: false,
    busy: false,
  });
  const [confirm, setConfirm] = useState(false);
  const requestClose = useCallback(() => {
    if (status.busy) return;
    if (status.dirty) {
      previousField.current = document.activeElement as HTMLElement;
      setConfirm(true);
    } else onClose();
  }, [status, onClose]);
  const context = useMemo(
    () => ({ requestClose, setFormStatus }),
    [requestClose],
  );
  useEffect(() => {
    const dialog = ref.current!;
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    titleRef.current?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  useEffect(() => {
    if (confirm) keepRef.current?.focus();
  }, [confirm]);
  const keepEditing = () => {
    setConfirm(false);
    requestAnimationFrame(() => previousField.current?.focus());
  };
  const outside = (
    event:
      | React.PointerEvent<HTMLDialogElement>
      | React.MouseEvent<HTMLDialogElement>,
  ) => {
    const box = event.currentTarget.getBoundingClientRect();
    return (
      event.target === event.currentTarget &&
      (event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom)
    );
  };
  return (
    <dialog
      ref={ref}
      className={`modal modal-${size}`}
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
      onKeyDown={(event) => {
        if (
          event.key !== "Tab" ||
          event.defaultPrevented ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey
        )
          return;
        // Radix manages focus inside an open select menu itself.
        if (event.currentTarget.querySelector('[role="listbox"]')) return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            "button, a[href], input, textarea, select, [tabindex]",
          ),
        ).filter(
          (element) =>
            element.tabIndex >= 0 &&
            !element.matches(':disabled, [aria-hidden="true"]') &&
            !element.closest("[inert]") &&
            element.getClientRects().length > 0,
        );
        const active = document.activeElement as HTMLElement;
        if (!controls.length) {
          event.preventDefault();
          return;
        }
        if (
          !controls.includes(active) ||
          (event.shiftKey ? active === controls[0] : active === controls.at(-1))
        ) {
          event.preventDefault();
          (event.shiftKey ? controls.at(-1) : controls[0])?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (confirm) keepEditing();
        else requestClose();
      }}
      onPointerDown={(event) => {
        backdropDown.current = outside(event);
      }}
      onClick={(event) => {
        if (backdropDown.current && outside(event) && !confirm) requestClose();
        backdropDown.current = false;
      }}
    >
      <header className="modal-header" inert={confirm}>
        {icon && (
          <span className="modal-icon" aria-hidden="true">
            {icon}
          </span>
        )}
        <div className="modal-heading">
          <h2 ref={titleRef} tabIndex={-1} id={`${id}-title`}>
            {title}
          </h2>
          {description && <p id={`${id}-description`}>{description}</p>}
        </div>
        <button
          type="button"
          className="icon-button modal-close"
          aria-label="Đóng"
          disabled={status.busy}
          onClick={requestClose}
        >
          <X size={19} />
        </button>
      </header>
      <div className="modal-body" inert={confirm}>
        <ModalContext.Provider value={context}>
          {children}
        </ModalContext.Provider>
      </div>
      {confirm && (
        <div
          className="modal-discard"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={`${id}-discard-title`}
          aria-describedby={`${id}-discard-description`}
        >
          <div className="modal-discard-content">
            <TriangleAlert size={25} aria-hidden="true" />
            <h3 id={`${id}-discard-title`}>Bỏ thay đổi chưa lưu?</h3>
            <p id={`${id}-discard-description`}>
              Nội dung vừa nhập sẽ không được lưu. Bạn có thể quay lại để tiếp
              tục hoàn tất.
            </p>
            <div className="modal-discard-actions">
              <Button type="button" variant="secondary" onClick={onClose}>
                Bỏ thay đổi
              </Button>
              <Button ref={keepRef} type="button" onClick={keepEditing}>
                Tiếp tục nhập
              </Button>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
