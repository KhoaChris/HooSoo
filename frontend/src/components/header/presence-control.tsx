import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  Check,
  ChevronDown,
  Circle,
  MinusCircle,
  EyeOff,
  UserRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import { presenceLabels, type PresenceMode } from "@hoosoo/shared";
import { Avatar } from "../ui/avatar";
import { t, useLocale } from "../../i18n";
import { api } from "../../services/api-client";
import { usePresence } from "../../services/presence-state";
import "../../style/components/presence.css";
const choices = [
  { mode: "online", icon: Circle, hint: "Hiển thị đang hoạt động" },
  { mode: "dnd", icon: MinusCircle, hint: "Tạm ẩn dấu báo thông báo mới" },
  {
    mode: "invisible",
    icon: EyeOff,
    hint: "Hiển thị ngoại tuyến với mọi người",
  },
] as const;
export function PresenceControl({
  name,
  employeeId,
  avatarUrl,
  roleLabel,
}: {
  name: string;
  employeeId: string;
  avatarUrl?: string | null;
  roleLabel: string;
}) {
  useLocale();
  const { connected, mode } = usePresence();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const choose = async (value: PresenceMode) => {
    if (busy || !connected || value === mode) return;
    setBusy(true);
    setError("");
    try {
      await api("/me/presence", { method: "PATCH", body: { mode: value } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className="presence-trigger"
          type="button"
          aria-label={
            t("Trạng thái hoạt động") +
            ": " +
            t(connected ? presenceLabels[mode] : presenceLabels.unknown)
          }
        >
          <Avatar name={name} src={avatarUrl} employeeId={employeeId} />
          <span className="topbar-identity">
            <strong>{name}</strong>
            <small>{roleLabel}</small>
          </span>
          <ChevronDown size={14} className="presence-trigger-chevron" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="presence-menu"
          align="end"
          sideOffset={12}
          collisionPadding={12}
          aria-label={t("Trạng thái hoạt động")}
        >
          <header>
            <strong>{t("Trạng thái hoạt động")}</strong>
            <small>
              {t(connected ? presenceLabels[mode] : presenceLabels.unknown)}
            </small>
          </header>
          <div role="group" aria-label={t("Chọn trạng thái")}>
            {choices.map(({ mode: value, icon: Icon, hint }) => (
              <button
                type="button"
                key={value}
                data-state={value}
                aria-pressed={mode === value}
                disabled={busy || !connected}
                onClick={() => void choose(value)}
              >
                <Icon size={19} />
                <span>
                  <strong>{t(presenceLabels[value])}</strong>
                  <small>{t(hint)}</small>
                </span>
                {mode === value && <Check size={17} />}
              </button>
            ))}
          </div>
          {error && (
            <p className="presence-error" role="alert">
              {t(error)}
            </p>
          )}
          <footer>
            <Link to="/profile" onClick={() => setOpen(false)}>
              <UserRound size={17} />
              {t("Hồ sơ của tôi")}
            </Link>
          </footer>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
