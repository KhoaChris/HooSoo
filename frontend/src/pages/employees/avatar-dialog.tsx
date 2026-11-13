import { StableText } from "../../i18n/stable-text";
import { t, useLocale } from "../../i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, Trash2, RotateCcw } from "lucide-react";
import type { EmployeeView } from "@hoosoo/shared";
import { Button, Modal } from "../../components/ui";
import { Avatar } from "../../components/ui/avatar";
import { useModalForm } from "../../components/ui/modal";
import { useAction } from "../../hooks/data";
import { cropAvatar, readAvatar, type AvatarSource } from "./avatar-image";

export function AvatarDialog({
  employee,
  personal,
  onClose,
}: {
  employee: EmployeeView;
  personal: boolean;
  onClose: () => void;
}) {
  useLocale();
  return (
    <Modal
      title={t("Ảnh đại diện")}
      description={employee.name}
      icon={<Camera size={21} />}
      onClose={onClose}
    >
      <AvatarEditor employee={employee} personal={personal} onClose={onClose} />
    </Modal>
  );
}
function AvatarEditor({
  employee,
  personal,
  onClose,
}: {
  employee: EmployeeView;
  personal: boolean;
  onClose: () => void;
}) {
  useLocale();
  const [version] = useState(employee.avatarVersion ?? 0);
  const [source, setSource] = useState<AvatarSource | null>(null),
    [zoom, setZoom] = useState(1),
    [x, setX] = useState(50),
    [y, setY] = useState(50);
  const [remove, setRemove] = useState(false),
    [reading, setReading] = useState(false),
    [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null),
    sequence = useRef(0),
    alive = useRef(true);
  const action = useAction(),
    modal = useModalForm(),
    busy = reading || action.isPending;
  const preview = useMemo(
    () => (source ? cropAvatar(source, zoom, x, y) : null),
    [source, zoom, x, y],
  );
  const dirty = !!source || remove;
  useEffect(() => {
    modal?.setFormStatus({ dirty, busy });
  }, [dirty, busy, modal?.setFormStatus]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      sequence.current++;
    };
  }, []);
  useEffect(
    () => () => {
      if (source) URL.revokeObjectURL(source.url);
    },
    [source],
  );
  async function choose(file?: File) {
    if (!file) return;
    const id = ++sequence.current;
    setReading(true);
    setError("");
    try {
      const next = await readAvatar(file);
      if (!alive.current || id !== sequence.current) {
        URL.revokeObjectURL(next.url);
        return;
      }
      setSource(next);
      setRemove(false);
      setZoom(1);
      setX(50);
      setY(50);
    } catch (e) {
      if (alive.current && id === sequence.current)
        setError((e as Error).message);
    } finally {
      if (alive.current && id === sequence.current) setReading(false);
    }
  }
  return (
    <div className="avatar-editor">
      <div className="avatar-editor-preview">
        {preview ? (
          <img src={preview} alt={t("Xem trước ảnh đại diện")} />
        ) : (
          <Avatar
            name={employee.name}
            src={remove ? null : employee.avatarUrl}
            className="avatar-editor-current"
          />
        )}
      </div>
      {remove && (
        <p className="avatar-editor-caption">
          <StableText>{t("Ảnh sẽ được gỡ sau khi lưu.")}</StableText>
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-label={t("Chọn tệp ảnh đại diện")}
        disabled={busy}
        onChange={(e) => {
          void choose(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div className="avatar-editor-tools">
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <ImagePlus size={16} />
          {source || employee.avatarUrl ? t("Chọn ảnh khác") : t("Chọn ảnh")}
        </Button>
        {(source || (employee.avatarUrl && !remove)) && (
          <Button
            type="button"
            variant="ghost"
            tone="danger"
            disabled={busy}
            onClick={() => {
              setSource(null);
              setRemove(!!employee.avatarUrl);
              setError("");
            }}
          >
            <Trash2 size={16} />
            {t("Gỡ ảnh")}
          </Button>
        )}
      </div>
      <small className="avatar-editor-caption">
        <StableText>{t("JPG, PNG hoặc WebP · Tối đa 8 MB")}</StableText>
      </small>
      {source && (
        <fieldset className="avatar-crop-controls" disabled={busy}>
          <legend>{t("Căn chỉnh ảnh")}</legend>
          <label>
            <StableText>{t("Phóng to")}</StableText>{" "}
            <output>{Math.round(zoom * 100)}%</output>
            <input
              type="range"
              aria-label={t("Phóng to ảnh")}
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(+e.target.value)}
            />
          </label>
          <label>
            <StableText>{t("Vị trí ngang")}</StableText>
            <input
              type="range"
              min="0"
              max="100"
              value={x}
              onChange={(e) => setX(+e.target.value)}
            />
          </label>
          <label>
            <StableText>{t("Vị trí dọc")}</StableText>
            <input
              type="range"
              min="0"
              max="100"
              value={y}
              onChange={(e) => setY(+e.target.value)}
            />
          </label>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setZoom(1);
              setX(50);
              setY(50);
            }}
          >
            <RotateCcw size={14} />
            {t("Căn giữa")}
          </Button>
        </fieldset>
      )}
      {reading && (
        <p role="status">
          <StableText>{t("Đang xử lý ảnh…")}</StableText>
        </p>
      )}
      {error && (
        <p role="alert" className="avatar-editor-error">
          {error}
        </p>
      )}
      <div className="form-actions avatar-editor-footer">
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => modal?.requestClose()}
        >
          {t("Hủy")}
        </Button>
        <Button
          type="button"
          busy={action.isPending}
          tone={remove ? "danger" : "success"}
          disabled={!dirty || busy}
          onClick={async () => {
            setError("");
            try {
              await action.mutateAsync({
                path: personal
                  ? "/me/avatar"
                  : `/employees/${employee.id}/avatar`,
                method: "PATCH",
                body: { image: remove ? null : preview, version },
              });
              onClose();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          {t("Lưu ảnh đại diện")}
        </Button>
      </div>
    </div>
  );
}
