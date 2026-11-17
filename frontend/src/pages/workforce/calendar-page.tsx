import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ArrowUpRight,
} from "lucide-react";
import { isSupervisorRole, type Deadline } from "@hoosoo/shared";
import { useAuth } from "../../app/auth";
import { useApi } from "../../hooks/data";
import {
  Heading,
  Button,
  ErrorBox,
  Loading,
  Select,
  Checkbox,
} from "../../components/ui";
import { t, useLocale, intlLocale } from "../../i18n";
import { Empty, today, dateLabel } from "./common";
export function CalendarPage() {
  useLocale();
  const { me } = useAuth(),
    supervisor = !!me && isSupervisorRole(me.actor.role);
  const [month, setMonth] = useState(today().slice(0, 7)),
    [scope, setScope] = useState("my"),
    [date, setDate] = useState("");
  const first = new Date(month + "-01T00:00:00Z"),
    last = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
    );
  const start = new Date(first.getTime() - 30 * 86400000)
      .toISOString()
      .slice(0, 10),
    end = last.toISOString().slice(0, 10);
  const q = useApi<Deadline[]>(
    `/workforce/calendar/deadlines?scope=${scope}&start=${start}&end=${end}`,
  );
  const storageKey = `hoosoo.deadlines.${me?.actor.uid}`,
    [marks, setMarks] = useState<Record<string, "read" | "hidden">>(() => {
      try {
        return JSON.parse(localStorage.getItem(storageKey) || "{}");
      } catch {
        return {};
      }
    }),
    [showHidden, setShowHidden] = useState(false);
  const mark = (id: string, value: "read" | "hidden") => {
    const next = Object.fromEntries(
      [
        ...Object.entries(marks).filter(([key]) => key !== id),
        [id, value],
      ].slice(-200),
    ) as Record<string, "read" | "hidden">;
    setMarks(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* Storage may be unavailable in private mode. */
    }
  };
  const items = (q.data ?? []).filter(
    (r) =>
      (showHidden || marks[r.id] !== "hidden") && (!date || r.date === date),
  );
  const offset = (first.getUTCDay() + 6) % 7,
    days = last.getUTCDate();
  const go = (delta: number) => {
    setMonth(
      new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + delta, 1))
        .toISOString()
        .slice(0, 7),
    );
    setDate("");
  };
  const locale = intlLocale();
  return (
    <div className="wf-page">
      <Heading
        title={t("Lịch & nhắc hạn")}
        description={t(
          "Theo dõi những việc sắp đến hạn và các mục quá hạn trong 30 ngày trước kỳ đang xem.",
        )}
      />
      <div className="wf-toolbar">
        <div className="wf-actions">
          <Button
            variant="secondary"
            aria-label={t("Tháng trước")}
            onClick={() => go(-1)}
          >
            <ChevronLeft size={18} />
          </Button>
          <strong>
            {new Intl.DateTimeFormat(locale, {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }).format(first)}
          </strong>
          <Button
            variant="secondary"
            aria-label={t("Tháng sau")}
            onClick={() => go(1)}
          >
            <ChevronRight size={18} />
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setMonth(today().slice(0, 7));
              setDate("");
            }}
          >
            {t("Hôm nay")}
          </Button>
        </div>
        {supervisor && (
          <Select
            aria-label={t("Phạm vi")}
            value={scope}
            onValueChange={setScope}
            options={[
              { value: "my", label: t("Của tôi") },
              { value: "team", label: t("Trong phạm vi quản lý") },
            ]}
          />
        )}
      </div>
      <ErrorBox error={q.error} />
      {q.isLoading ? (
        <Loading />
      ) : (
        <div className="wf-calendar-layout">
          <section className="wf-calendar" aria-label={t("Lịch tháng")}>
            <div className="wf-calendar-grid">
              {Array.from({ length: 7 }, (_, i) => (
                <span className="wf-weekday" key={i}>
                  {new Intl.DateTimeFormat(locale, {
                    weekday: "short",
                    timeZone: "UTC",
                  }).format(new Date(Date.UTC(2026, 10, 16 + i)))}
                </span>
              ))}
              {Array.from({ length: offset }, (_, i) => (
                <span key={`blank-${i}`} />
              ))}
              {Array.from({ length: days }, (_, i) => {
                const day = month + "-" + String(i + 1).padStart(2, "0"),
                  count = q.data?.filter((r) => r.date === day).length ?? 0;
                return (
                  <button
                    key={day}
                    className={`wf-day ${day === today() ? "is-today" : ""} ${date === day ? "selected" : ""}`}
                    aria-pressed={date === day}
                    aria-label={`${dateLabel(day)} · ${count} ${t("việc đến hạn")}`}
                    onClick={() => setDate(date === day ? "" : day)}
                  >
                    <span>{i + 1}</span>
                    {count > 0 && <small>{count}</small>}
                  </button>
                );
              })}
            </div>
          </section>
          <section className="wf-agenda">
            <p className="wf-hint">
              {t("Trạng thái đã đọc và ẩn được lưu trên thiết bị này.")}
            </p>
            <label className="wf-confirm">
              <Checkbox
                checked={showHidden}
                onChange={(e) => setShowHidden(e.target.checked)}
              />
              <span>{t("Hiện các mục đã ẩn")}</span>
            </label>
            <header>
              <h2>
                <CalendarDays size={19} />
                {date ? dateLabel(date) : t("Danh sách cần theo dõi")}
              </h2>
              {date && (
                <Button variant="ghost" onClick={() => setDate("")}>
                  {t("Xem tất cả")}
                </Button>
              )}
            </header>
            {!items.length ? (
              <Empty />
            ) : (
              <ol>
                {items.map((r) => (
                  <li key={r.id}>
                    <time className={r.overdue ? "wf-overdue" : ""}>
                      {dateLabel(r.date)}
                      {r.overdue && <small>{t("Quá hạn")}</small>}
                    </time>
                    <div>
                      <strong>{t(r.title)}</strong>
                      <p>{r.employeeName}</p>
                      <div className="wf-actions">
                        <Link to={r.href} onClick={() => mark(r.id, "read")}>
                          {t("Mở hồ sơ")}
                          <ArrowUpRight size={14} />
                        </Link>
                        <Button
                          variant="ghost"
                          onClick={() => mark(r.id, "hidden")}
                        >
                          {t("Ẩn")}
                        </Button>
                        {marks[r.id] && (
                          <small>
                            {t(marks[r.id] === "read" ? "Đã đọc" : "Đã ẩn")}
                          </small>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
