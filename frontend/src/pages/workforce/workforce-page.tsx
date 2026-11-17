import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Plus,
  Search,
  CalendarDays,
  WalletCards,
  FileText,
  ArrowUpRight,
  Pin,
  CheckCheck,
  Download,
} from "lucide-react";
import {
  isSupervisorRole,
  type TimeRequestView,
  type PayrollView,
  type PersonnelChangeView,
  type PersonnelDocumentView,
  type AnnouncementView,
} from "@hoosoo/shared";
import { useAuth } from "../../app/auth";
import { useApi } from "../../hooks/data";
import { api } from "../../services/api-client";
import {
  Button,
  ErrorBox,
  Heading,
  Input,
  Loading,
  Modal,
  Select,
} from "../../components/ui";
import { t, useLocale } from "../../i18n";
import {
  Status,
  Empty,
  History,
  Decision,
  actions,
  dateLabel,
  money,
  today,
  printRecord,
  type Workspace,
} from "./common";
import {
  TimeEditor,
  PayrollEditor,
  ChangeEditor,
  DocumentEditor,
  AnnouncementEditor,
} from "./editors";
import { CalendarPage } from "./calendar-page";
import { ImportPage } from "./import-page";
import "./workforce.css";
type Item =
  | TimeRequestView
  | PayrollView
  | PersonnelChangeView
  | PersonnelDocumentView
  | AnnouncementView;
const titles: Record<string, string> = {
  time: "Tăng ca & nghỉ theo giờ",
  payroll: "Kỳ lương & phiếu lương",
  changes: "Điều chuyển & bổ nhiệm",
  documents: "Tài liệu nhân sự",
  announcements: "Bản tin & chính sách",
};
const descriptions: Record<string, string> = {
  time: "Đề nghị, phê duyệt và theo dõi thời gian làm việc bổ sung.",
  payroll: "Đối soát dữ liệu, duyệt kỳ lương và công bố phiếu lương cá nhân.",
  changes: "Theo dõi thay đổi công việc từ đề nghị đến ngày có hiệu lực.",
  documents: "Một nơi lưu tài liệu, lịch sử phiên bản và thời hạn sử dụng.",
  announcements: "Cập nhật nội bộ và xác nhận chính sách theo từng phiên bản.",
};
export function WorkforcePage() {
  const { section = "announcements" } = useParams();
  return section === "calendar" ? (
    <CalendarPage />
  ) : section === "imports" ? (
    <ImportPage />
  ) : titles[section] ? (
    <RecordsPage key={section} section={section} />
  ) : (
    <Empty />
  );
}
function RecordsPage({ section }: { section: string }) {
  useLocale();
  const { me } = useAuth(),
    [params, setParams] = useSearchParams();
  const supervisor = !!me && isSupervisorRole(me.actor.role),
    scope = supervisor && params.get("scope") === "team" ? "team" : "my";
  const [period, setPeriod] = useState(() => {
      const d = new Date(today() + "T00:00:00Z");
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1))
        .toISOString()
        .slice(0, 7);
    }),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1),
    [detailId, setDetailId] = useState<string | null>(params.get("record")),
    [editor, setEditor] = useState<Item | "new" | null>(null),
    [decision, setDecision] = useState<{ item: Item; action: string } | null>(
      null,
    ),
    [receiptId, setReceiptId] = useState<string | null>(null);
  const q = useApi<Workspace<Item>>(
    `/workforce/${section}?scope=${scope}${section === "payroll" ? `&period=${period}` : ""}`,
  );
  const rows = (q.data?.items ?? []).filter(
      (r) =>
        (!params.get("employee") ||
          !("employeeId" in r) ||
          r.employeeId === params.get("employee")) &&
        (!status || r.status === status) &&
        JSON.stringify(
          "employeeName" in r
            ? [r.employeeName, "title" in r ? r.title : ""]
            : ["title" in r ? r.title : ""],
        )
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase()),
    ),
    detail = q.data?.items.find((r) => r.id === detailId);
  const maxPage = Math.max(1, Math.ceil(rows.length / 10)),
    currentPage = Math.min(page, maxPage);
  const openAction = (r: Item, action: string) =>
    action === "edit" ? setEditor(r) : setDecision({ item: r, action });
  const actionButtons = (r: Item) => {
    const permitted =
      "actions" in r
        ? r.actions
        : "canReview" in r
          ? [
              ...(r.canReview ? ["approve", "reject"] : []),
              ...(r.canCancel ? ["cancel"] : []),
            ]
          : "canEdit" in r
            ? r.canEdit
              ? ["edit", "archive"]
              : []
            : "canManage" in r
              ? [
                  ...(r.canManage && r.status !== "archived"
                    ? [
                        "edit",
                        ...(r.status === "draft" ? ["publish"] : []),
                        "archive",
                      ]
                    : []),
                  ...(r.status === "published" &&
                  r.requiresAcknowledgement &&
                  !r.acknowledged
                    ? ["acknowledge"]
                    : []),
                ]
              : [];
    return (
      <div className="wf-actions">
        {permitted.map((action) => (
          <Button
            key={action}
            variant={
              action === "approve" || action === "publish"
                ? "primary"
                : "secondary"
            }
            tone={
              ["reject", "void", "cancel", "archive"].includes(action)
                ? "danger"
                : action === "approve"
                  ? "success"
                  : undefined
            }
            onClick={() => openAction(r, action)}
          >
            {t(actions[action])}
          </Button>
        ))}
        {"canManage" in r && r.canManage && r.requiresAcknowledgement && (
          <Button variant="secondary" onClick={() => setReceiptId(r.id)}>
            {t("Theo dõi xác nhận")}
          </Button>
        )}
      </div>
    );
  };
  return (
    <div className="wf-page">
      <Heading
        title={t(titles[section])}
        description={t(descriptions[section])}
        action={
          q.data?.canCreate ? (
            <Button onClick={() => setEditor("new")}>
              <Plus size={17} />
              {t(
                section === "announcements"
                  ? "Soạn bản tin"
                  : section === "payroll"
                    ? "Lập phiếu lương"
                    : "Tạo mới",
              )}
            </Button>
          ) : undefined
        }
      />
      <div className="wf-toolbar">
        <label className="wf-search">
          <Search size={17} />
          <Input
            aria-label={t("Tìm kiếm")}
            placeholder={t("Tìm theo tên hoặc nội dung…")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        {supervisor && section !== "announcements" && (
          <Select
            aria-label={t("Phạm vi")}
            value={scope}
            onValueChange={(v) => {
              setParams({ scope: v });
              setDetailId(null);
            }}
            options={[
              { value: "my", label: t("Của tôi") },
              { value: "team", label: t("Trong phạm vi quản lý") },
            ]}
          />
        )}
        {section === "payroll" && (
          <Input
            aria-label={t("Tháng lương")}
            type="month"
            value={period}
            onChange={(e) => {
              if (e.target.value) setPeriod(e.target.value);
            }}
          />
        )}
        <Select
          aria-label={t("Trạng thái")}
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[
            { value: "", label: t("Tất cả trạng thái") },
            ...Array.from(
              new Set((q.data?.items ?? []).map((r) => r.status)),
            ).map((value) => ({
              value,
              label: t(
                (
                  {
                    draft: "Bản nháp",
                    review: "Chờ đối soát",
                    approved: "Đã duyệt",
                    published: "Đã công bố",
                    voided: "Đã hủy hiệu lực",
                    pending: "Chờ duyệt",
                    rejected: "Đã từ chối",
                    cancelled: "Đã hủy",
                    applied: "Đã áp dụng",
                    active: "Đang lưu trữ",
                    archived: "Đã lưu trữ",
                  } as Record<string, string>
                )[value],
              ),
            })),
          ]}
        />
      </div>
      <ErrorBox error={q.error} retry={() => void q.refetch()} />
      {q.isLoading ? (
        <Loading />
      ) : !rows.length ? (
        <Empty />
      ) : (
        <div
          className={`wf-records ${section === "announcements" ? "wf-news" : ""}`}
        >
          {rows.slice((currentPage - 1) * 10, currentPage * 10).map((r) => (
            <article className="wf-card" key={r.id}>
              <div className="wf-card-top">
                <span className="wf-record-icon">
                  {section === "payroll" ? (
                    <WalletCards size={19} />
                  ) : section === "time" ? (
                    <CalendarDays size={19} />
                  ) : (
                    <FileText size={19} />
                  )}
                </span>
                <Status value={r.status} />
                {"pinned" in r && r.pinned && (
                  <Pin size={15} aria-label={t("Đã ghim")} />
                )}
              </div>
              <h2>
                <button
                  className="wf-card-title"
                  onClick={() => setDetailId(r.id)}
                >
                  {"title" in r ? r.title : r.employeeName}
                </button>
              </h2>
              {"employeeName" in r && "title" in r && <p>{r.employeeName}</p>}
              {section === "time" && (
                <TimeSummary item={r as TimeRequestView} />
              )}{" "}
              {section === "payroll" && (
                <div className="wf-pay-amount">
                  <span>{(r as PayrollView).period}</span>
                  <strong>{money((r as PayrollView).netAmount)}</strong>
                </div>
              )}
              {section === "changes" && (
                <p>
                  {t(
                    (r as PersonnelChangeView).kind === "transfer"
                      ? "Điều chuyển"
                      : "Bổ nhiệm",
                  )}{" "}
                  · {dateLabel((r as PersonnelChangeView).effectiveDate)}
                </p>
              )}
              {section === "documents" && (
                <p>
                  {t("Phiên bản")} {(r as PersonnelDocumentView).files.length} ·{" "}
                  {dateLabel(r.updatedAt ?? r.createdAt ?? "")}
                </p>
              )}
              {section === "announcements" && (
                <>
                  <p className="wf-excerpt">{(r as AnnouncementView).body}</p>
                  <small>
                    {dateLabel((r as AnnouncementView).publishOn)} ·{" "}
                    {t("Phiên bản")} {(r as AnnouncementView).contentVersion}
                  </small>
                  {(r as AnnouncementView).acknowledged && (
                    <span className="wf-read">
                      <CheckCheck size={15} />
                      {t("Đã xác nhận đọc")}
                    </span>
                  )}
                </>
              )}
              <footer>
                <Button variant="ghost" onClick={() => setDetailId(r.id)}>
                  {t("Xem chi tiết")}
                  <ArrowUpRight size={15} />
                </Button>
              </footer>
            </article>
          ))}
        </div>
      )}
      {rows.length > 10 && (
        <div className="wf-pagination">
          <Button
            variant="secondary"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            {t("Trước")}
          </Button>
          <span>
            {currentPage} / {maxPage}
          </span>
          <Button
            variant="secondary"
            disabled={currentPage === maxPage}
            onClick={() => setPage(currentPage + 1)}
          >
            {t("Tiếp")}
          </Button>
        </div>
      )}
      {detail && (
        <Modal
          title={"title" in detail ? detail.title : detail.employeeName}
          size="wide"
          onClose={() => setDetailId(null)}
        >
          <div className="wf-detail">
            <Status value={detail.status} />
            {section === "time" && (
              <>
                <TimeSummary item={detail as TimeRequestView} />
                <p className="wf-prose">{(detail as TimeRequestView).reason}</p>
              </>
            )}
            {section === "payroll" && (
              <PayrollDetail item={detail as PayrollView} />
            )}{" "}
            {section === "changes" && (
              <ChangeDetail
                item={detail as PersonnelChangeView}
                workspace={q.data!}
              />
            )}{" "}
            {section === "documents" && (
              <DocumentDetail item={detail as PersonnelDocumentView} />
            )}{" "}
            {section === "announcements" && (
              <div className="wf-prose">
                {(detail as AnnouncementView).body}
              </div>
            )}
            {actionButtons(detail)}
            <History events={detail.history} />
          </div>
        </Modal>
      )}
      {editor && q.data && (
        <>
          {section === "time" ? (
            <TimeEditor workspace={q.data} onClose={() => setEditor(null)} />
          ) : section === "payroll" ? (
            <PayrollEditor
              workspace={q.data}
              item={editor === "new" ? undefined : (editor as PayrollView)}
              onClose={() => setEditor(null)}
            />
          ) : section === "changes" ? (
            <ChangeEditor
              workspace={q.data}
              item={
                editor === "new" ? undefined : (editor as PersonnelChangeView)
              }
              onClose={() => setEditor(null)}
            />
          ) : section === "documents" ? (
            <DocumentEditor
              workspace={q.data}
              item={
                editor === "new" ? undefined : (editor as PersonnelDocumentView)
              }
              onClose={() => setEditor(null)}
            />
          ) : (
            <AnnouncementEditor
              workspace={q.data}
              item={editor === "new" ? undefined : (editor as AnnouncementView)}
              onClose={() => setEditor(null)}
            />
          )}
        </>
      )}
      {decision && (
        <Decision
          section={section}
          id={decision.item.id}
          version={decision.item.version}
          action={decision.action}
          onClose={() => setDecision(null)}
        />
      )}{" "}
      {receiptId && (
        <ReceiptReport id={receiptId} onClose={() => setReceiptId(null)} />
      )}
    </div>
  );
}
function TimeSummary({ item: r }: { item: TimeRequestView }) {
  return (
    <div className="wf-meta">
      <strong>{t(r.kind === "overtime" ? "Tăng ca" : "Nghỉ theo giờ")}</strong>
      <span>
        {dateLabel(r.date)} · {r.start}–{r.end}
      </span>
      <span>
        {r.minutes} {t("phút")}
        {r.days > 0 ? ` · ${r.days} ${t("ngày phép")}` : ""}
      </span>
    </div>
  );
}
function PayrollDetail({ item: r }: { item: PayrollView }) {
  const rows: [string, string][] = [
    [t("Nhân viên"), r.employeeName],
    [t("Tháng lương"), r.period],
    [t("Lương cơ bản theo kỳ"), money(r.source.baseAmount)],
    [t("Phụ cấp theo kỳ"), money(r.source.allowanceAmount)],
    [
      t("Tiền tăng ca"),
      money(Math.round((r.source.overtimeMinutes / 60) * r.overtimeRate)),
    ],
    ...r.earnings.map((x) => [x.label, money(x.amount)] as [string, string]),
    ...r.deductions.map(
      (x) => [x.label, `−${money(x.amount)}`] as [string, string],
    ),
    [t("Tổng thu nhập"), money(r.totalEarnings)],
    [t("Tổng khấu trừ"), money(r.totalDeductions)],
    [t("Thực nhận"), money(r.netAmount)],
  ];
  return (
    <>
      <div className="wf-pay-banner">
        <span>
          {r.period} · {t("Phiên bản")} {r.version}
        </span>
        <strong>{money(r.netAmount)}</strong>
        <small>{t("Thực nhận")}</small>
      </div>
      <dl className="wf-dl">
        {rows.slice(2).map(([key, value], i) => (
          <div key={i}>
            <dt>{key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <section className="wf-inset">
        <h3>{t("Đối soát nguồn dữ liệu")}</h3>
        <dl className="wf-dl">
          <div>
            <dt>{t("Ngày công trong kỳ / chuẩn")}</dt>
            <dd>
              {r.source.employmentDays} / {r.source.scheduledDays}
            </dd>
          </div>
          <div>
            <dt>{t("Thời gian chấm công")}</dt>
            <dd>
              {r.source.attendanceMinutes} {t("phút")}
            </dd>
          </div>
          <div>
            <dt>{t("Tăng ca đã đối chiếu")}</dt>
            <dd>
              {r.source.overtimeMinutes} {t("phút")}
            </dd>
          </div>
          <div>
            <dt>{t("Nghỉ phép / nghỉ theo giờ")}</dt>
            <dd>
              {r.source.paidLeaveDays} {t("ngày")} /{" "}
              {r.source.hourlyLeaveMinutes} {t("phút")}
            </dd>
          </div>
        </dl>
        {r.source.missingAttendanceDates.length > 0 && (
          <p className="wf-warning">
            {t("Ngày chưa đủ chấm công (cần đối soát)")}:{" "}
            {r.source.missingAttendanceDates.map(dateLabel).join(", ")}
          </p>
        )}
        <p className="wf-hint">
          {t(
            "Ngày thiếu chấm công không tự động bị trừ lương. Người duyệt kiểm tra căn cứ và các khoản khấu trừ.",
          )}
        </p>
      </section>
      <p className="wf-prose">{r.reason}</p>
      {r.status === "published" && (
        <Button
          variant="secondary"
          onClick={() =>
            printRecord(
              t("Phiếu lương cá nhân"),
              rows,
              `${t("Ngày công bố")}: ${dateLabel(r.publishedAt)}\n${r.reason}`,
            )
          }
        >
          <Download size={16} />
          {t("In / lưu PDF")}
        </Button>
      )}
      {r.revisions.length > 0 && (
        <details>
          <summary>
            {t("Các phiên bản trước")} · {r.revisions.length}
          </summary>
          {r.revisions.map((v) => (
            <p key={v.version}>
              v{v.version} · {money(v.netAmount)} · {v.reason}
            </p>
          ))}
        </details>
      )}
    </>
  );
}
function ChangeDetail({
  item: r,
  workspace: w,
}: {
  item: PersonnelChangeView;
  workspace: Workspace<unknown>;
}) {
  return (
    <>
      <dl className="wf-dl">
        <div>
          <dt>{t("Phòng ban")}</dt>
          <dd>
            {w.departments.find((v) => v.id === r.before.departmentId)?.name ??
              r.before.departmentId}{" "}
            →{" "}
            {w.departments.find((v) => v.id === r.departmentId)?.name ??
              r.departmentId}
          </dd>
        </div>
        <div>
          <dt>{t("Chức danh")}</dt>
          <dd>
            {w.positions.find((v) => v.id === r.before.positionId)?.name ??
              r.before.positionId}{" "}
            →{" "}
            {w.positions.find((v) => v.id === r.positionId)?.name ??
              r.positionId}
          </dd>
        </div>
        <div>
          <dt>{t("Ngày hiệu lực")}</dt>
          <dd>{dateLabel(r.effectiveDate)}</dd>
        </div>
      </dl>
      <p className="wf-prose">{r.reason}</p>
      <div className="wf-links">
        <Link to={`/compensation?employeeId=${r.employeeId}`}>
          {t("Hồ sơ lương liên quan")}
          <ArrowUpRight size={15} />
        </Link>
        <Link to="/employment">
          {t("Hợp đồng liên quan")}
          <ArrowUpRight size={15} />
        </Link>
      </div>
      <p className="wf-hint">
        {t(
          "Sau khi được duyệt, nhân sự áp dụng thay đổi từ ngày hiệu lực. Hồ sơ lương và hợp đồng được xử lý theo quy trình riêng.",
        )}
      </p>
    </>
  );
}
function DocumentDetail({ item: r }: { item: PersonnelDocumentView }) {
  const [error, setError] = useState<Error | null>(null),
    [busy, setBusy] = useState(false);
  return (
    <>
      <ErrorBox error={error} />
      <p>{r.employeeName}</p>
      {r.expiresOn && (
        <p>
          {t("Ngày hết hạn")}: {dateLabel(r.expiresOn)}
        </p>
      )}
      <ol className="wf-versions">
        {r.files
          .slice()
          .reverse()
          .map((f) => (
            <li key={f.version}>
              <div>
                <strong>{f.fileName}</strong>
                <small>
                  v{f.version} · {Math.ceil(f.bytes / 1024)} KB ·{" "}
                  {dateLabel(f.uploadedAt)}
                </small>
              </div>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    const blob = await api<Blob>(
                      `/workforce/documents/${r.id}/download`,
                      {
                        download: true,
                        method: "POST",
                        key: crypto.randomUUID(),
                        body: { fileVersion: f.version },
                      },
                    );
                    const url = URL.createObjectURL(blob),
                      link = document.createElement("a");
                    link.href = url;
                    link.download = f.fileName;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  } catch (e) {
                    setError(e as Error);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t("Tải xuống")}
              </Button>
            </li>
          ))}
      </ol>
    </>
  );
}
function ReceiptReport({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useApi<
    { id: string; name: string; employeeCode: string; acknowledgedAt: string }[]
  >(`/workforce/announcements/${id}/receipts`);
  return (
    <Modal title={t("Theo dõi xác nhận")} onClose={onClose}>
      <ErrorBox error={q.error} />
      {q.isLoading ? (
        <Loading />
      ) : (
        <ol className="wf-versions">
          {q.data?.map((r) => (
            <li key={r.id}>
              <div>
                <strong>{r.name}</strong>
                <small>{r.employeeCode}</small>
              </div>
              <span>
                {r.acknowledgedAt
                  ? dateLabel(r.acknowledgedAt)
                  : t("Chưa xác nhận")}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
