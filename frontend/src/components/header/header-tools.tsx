import { useEffect, useRef, useState } from "react";
import {
  Bell,
  CheckCheck,
  Moon,
  Sun,
  Languages,
  X,
  Inbox,
  MessageCircle,
  CalendarDays,
  FileText,
  ArrowUpRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { NotificationFeed, NotificationItem } from "@hoosoo/shared";
import { useApi } from "../../hooks/data";
import { useAuth } from "../../app/auth";
import {
  usePreferences,
  setPreferences,
  intlLocale,
} from "../../i18n/preferences";
import { t } from "../../i18n";
import { Select } from "../ui/select";
import { ErrorBox } from "../ui/error-box";
import {
  readNotificationIds,
  markNotificationsRead,
} from "./notification-state";

function notificationTitle(item: NotificationItem) {
  if (item.kind === "chat") return t("Tin nhắn mới");
  if (item.requiresAction)
    return t(
      item.kind === "leave"
        ? "Đơn nghỉ phép cần duyệt"
        : item.kind === "work"
          ? "Lịch làm việc cần duyệt"
          : "Phiếu đề nghị cần duyệt",
    );
  const kind = t(
    item.kind === "leave"
      ? "Đơn nghỉ phép"
      : item.kind === "work"
        ? "Lịch làm việc"
        : "Phiếu đề nghị",
  );
  const status: Record<string, string> = {
    pending: "Chờ duyệt",
    pending_manager: "Chờ quản lý duyệt",
    pending_hr: "Chờ nhân sự xác nhận",
    approved: "Đã duyệt",
    rejected: "Đã từ chối",
    cancelled: "Đã hủy",
  };
  return kind + " · " + t(status[item.status] ?? "Đã cập nhật");
}
export function HeaderTools() {
  const { theme, locale } = usePreferences();
  const { user } = useAuth();
  return (
    <div className="header-tools" aria-label={t("Tùy chọn cá nhân")}>
      <button
        className="header-tool"
        type="button"
        aria-label={t(
          theme === "light"
            ? "Chuyển sang chế độ tối"
            : "Chuyển sang chế độ sáng",
        )}
        title={t(theme === "light" ? "Chế độ tối" : "Chế độ sáng")}
        onClick={() =>
          setPreferences({ theme: theme === "light" ? "dark" : "light" })
        }
      >
        {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
      </button>
      <div className="header-language">
        <Languages size={17} aria-hidden="true" />
        <Select
          aria-label={t("Ngôn ngữ")}
          className="header-language-select"
          contentClassName="header-language-menu"
          displayValue={locale.toUpperCase()}
          value={locale}
          options={[
            { value: "vi", label: "VI · Tiếng Việt" },
            { value: "en", label: "EN · English" },
          ]}
          onValueChange={(value) =>
            setPreferences({ locale: value === "en" ? "en" : "vi" })
          }
        />
      </div>
      <Notifications key={user?.uid} uid={user!.uid} />
    </div>
  );
}
function Notifications({ uid }: { uid: string }) {
  usePreferences();
  const query = useApi<NotificationFeed>("/notifications");
  const [open, setOpen] = useState(false),
    [unreadOnly, setUnreadOnly] = useState(false);
  const key = `hoosoo:notifications:v1:${uid}`;
  const [read, setRead] = useState<string[]>(() => {
    try {
      return readNotificationIds(localStorage.getItem(key));
    } catch {
      return [];
    }
  });
  const wrapper = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const items = query.data?.items ?? [],
    unread = items.filter((item) => !read.includes(item.id));
  const mark = (ids: string[]) =>
    setRead((previous) => {
      const next = markNotificationsRead(previous, ids);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* Still marks read for this session. */
      }
      return next;
    });
  useEffect(() => {
    const changed = (e: StorageEvent) => {
      if (e.key === key || e.key === null)
        setRead(readNotificationIds(e.newValue));
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [key]);
  useEffect(() => {
    if (!open) return;
    heading.current?.focus();
    const outside = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div ref={wrapper} className="notification-anchor">
      <button
        ref={trigger}
        className={"header-tool" + (open ? " is-active" : "")}
        type="button"
        aria-label={
          t("Thông báo") + (unread.length ? ` (${unread.length})` : "")
        }
        aria-expanded={open}
        aria-controls="notification-panel"
        title={t("Thông báo")}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={20} />
        {unread.length > 0 && (
          <span className="notification-count" aria-hidden="true">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>
      {open && (
        <section
          className="notification-panel"
          id="notification-panel"
          role="dialog"
          aria-labelledby="notification-title"
        >
          <header>
            <div>
              <h2 ref={heading} tabIndex={-1} id="notification-title">
                {t("Thông báo")}
              </h2>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label={t("Đóng")}
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <X size={18} />
            </button>
          </header>
          <div className="notification-toolbar">
            <button
              type="button"
              aria-pressed={unreadOnly}
              className={unreadOnly ? "is-active" : ""}
              onClick={() => setUnreadOnly((v) => !v)}
            >
              {t("Chưa đọc")} <span>{unread.length}</span>
            </button>
            <button
              type="button"
              disabled={!unread.length}
              onClick={() => mark(unread.map((item) => item.id))}
            >
              <CheckCheck size={15} />
              {t("Đánh dấu đã đọc")}
            </button>
          </div>
          <div className="notification-list">
            {query.error ? (
              <ErrorBox
                error={query.error}
                retry={() => void query.refetch()}
              />
            ) : query.isPending ? (
              <p className="notification-empty">{t("Đang tải thông báo…")}</p>
            ) : !(unreadOnly ? unread : items).length ? (
              <div className="notification-empty">
                <Inbox size={30} />
                <strong>
                  {t(
                    unreadOnly
                      ? "Bạn đã xem hết thông báo"
                      : "Chưa có thông báo",
                  )}
                </strong>
              </div>
            ) : (
              (unreadOnly ? unread : items).map((item) => {
                const Icon =
                  item.kind === "chat"
                    ? MessageCircle
                    : item.kind === "request"
                      ? FileText
                      : CalendarDays;
                return (
                  <Link
                    className={
                      "notification-item" +
                      (read.includes(item.id) ? "" : " is-unread")
                    }
                    key={item.id}
                    to={item.href}
                    onClick={() => {
                      mark([item.id]);
                      setOpen(false);
                    }}
                  >
                    <span className="notification-icon">
                      <Icon size={18} />
                    </span>
                    <div>
                      <strong>{notificationTitle(item)}</strong>
                      {item.subject && <p>{item.subject}</p>}
                      <time dateTime={item.at}>
                        {item.at
                          ? new Intl.DateTimeFormat(intlLocale(), {
                              timeZone: "Asia/Ho_Chi_Minh",
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(item.at))
                          : ""}
                      </time>
                    </div>
                    <ArrowUpRight size={15} />
                  </Link>
                );
              })
            )}
          </div>
          <footer>
            {t("Chỉ hiển thị thông tin thuộc quyền truy cập của bạn.")}
          </footer>
        </section>
      )}
    </div>
  );
}
