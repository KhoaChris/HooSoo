import { reviewTitle } from "./performance-planning";
import { useState } from "react";
import { Target, Plus, Search, ArrowUpRight, Clock3, Send } from "lucide-react";
import {
  performanceStatusLabels,
  type PerformanceWorkspace,
  type PerformanceView,
  type PerformanceAction,
} from "@hoosoo/shared";
import {
  Heading,
  DataTable,
  Input,
  Select,
  Button,
  Checkbox,
} from "../../components/ui";
import { Avatar } from "../../components/ui/avatar";
import { useApi } from "../../hooks/data";
import { t, useLocale } from "../../i18n";
import { dayLabel, today } from "../workflows/workflow-ui";
import {
  PerformanceEditor,
  PerformanceAssessmentDialog,
  PerformanceDecision,
} from "./performance-editor";
import { PerformanceDetail, PerformanceBadge } from "./performance-detail";
import {
  PerformanceReports,
  PerformanceReportEditor,
} from "./performance-reports";
import "../../style/pages/performance.css";
export function PerformancePage({ personal = false }: { personal?: boolean }) {
  useLocale();
  const q = useApi<PerformanceWorkspace>(
    `/performance/reviews?scope=${personal ? "my" : "team"}`,
  );
  const [section, setSection] = useState("reviews");
  const [selected, setSelected] = useState<string[]>([]);
  const [reportEditor, setReportEditor] = useState(false);
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1),
    [pending, setPending] = useState(false);
  const [detailId, setDetail] = useState<string | null>(null),
    [editor, setEditor] = useState<PerformanceView | "new" | null>(null),
    [action, setAction] = useState<{
      item: PerformanceView;
      action: PerformanceAction;
    } | null>(null);
  const items = q.data?.items ?? [],
    needs = (i: PerformanceView) =>
      i.actions.some(
        (a) =>
          a === "acknowledge" ||
          (!["completed", "acknowledged"].includes(i.status) &&
            ["manager", "finalize", "launch"].includes(a)),
      );
  const rows = items.filter(
    (i) =>
      (!status || i.status === status) &&
      (!pending || needs(i)) &&
      `${i.employeeName} ${i.employeeCode} ${reviewTitle(i)}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  const selectedItems = items.filter(
    (i) => selected.includes(i.id) && i.canReport,
  );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / 12))),
    detail = items.find((i) => i.id === detailId);
  const done = items.filter((i) =>
    ["completed", "acknowledged"].includes(i.status),
  ).length;
  return (
    <div className="performance-page">
      <Heading
        title={t(personal ? "Kết quả đánh giá" : "Đánh giá hiệu suất")}
        action={
          q.data?.canCreate && (
            <Button
              disabled={!q.data.people.length}
              onClick={() => setEditor("new")}
            >
              <Plus size={17} />
              {t("Tạo kỳ đánh giá")}
            </Button>
          )
        }
      />
      {!personal && (
        <nav
          className="performance-workspace-tabs"
          aria-label={t("Đánh giá hiệu suất")}
        >
          <button
            aria-current={section === "reviews" ? "page" : undefined}
            onClick={() => setSection("reviews")}
          >
            {t("Đánh giá nhân viên")}
          </button>
          <button
            aria-current={section === "reports" ? "page" : undefined}
            onClick={() => setSection("reports")}
          >
            {t("Báo cáo cấp trên")}{" "}
            <span>
              {q.data?.reports?.filter((r) => r.canDecide).length || 0}
            </span>
          </button>
        </nav>
      )}
      {section === "reviews" && (
        <>
          {q.data && (
            <div className="performance-workspace-summary">
              <Target size={24} />
              <div>
                <strong>{t("Tiến độ đánh giá")}</strong>
                <span>
                  {t("{0} kỳ đánh giá · {1} đã hoàn tất", [items.length, done])}
                </span>
              </div>
              <button
                aria-pressed={pending}
                onClick={() => {
                  setPending((v) => !v);
                  setPage(1);
                }}
              >
                <Clock3 size={16} />
                {t("Cần xử lý ({0})", [items.filter(needs).length])}
              </button>
            </div>
          )}
          <DataTable
            title={t("Các kỳ đánh giá")}
            icon={<Target size={19} />}
            filtered={!!search || !!status || pending}
            data={
              q.data
                ? {
                    items: rows.slice((currentPage - 1) * 12, currentPage * 12),
                    total: rows.length,
                    page: currentPage,
                    pageSize: 12,
                  }
                : undefined
            }
            loading={q.isPending}
            error={q.error}
            onRetry={() => void q.refetch()}
            onPage={setPage}
            toolbar={
              <div className="filters">
                {!personal && (
                  <Button
                    variant="secondary"
                    disabled={!selectedItems.length}
                    onClick={() => setReportEditor(true)}
                  >
                    <Send size={16} />
                    {t("Gửi báo cáo ({0})", [selectedItems.length])}
                  </Button>
                )}
                <label className="search-input">
                  <Search size={17} />
                  <Input
                    aria-label={t("Tìm kỳ đánh giá")}
                    placeholder={t("Tên, mã nhân viên hoặc kỳ đánh giá…")}
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </label>
                <Select
                  aria-label={t("Trạng thái")}
                  value={status}
                  onValueChange={(v) => {
                    setStatus(v);
                    setPage(1);
                  }}
                  options={[
                    { value: "", label: t("Tất cả trạng thái") },
                    ...Object.entries(performanceStatusLabels)
                      .filter(
                        ([value]) =>
                          !["self_review", "hr_review"].includes(value),
                      )
                      .map(([value, label]) => ({ value, label: t(label) })),
                  ]}
                />
                {(search || status || pending) && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSearch("");
                      setStatus("");
                      setPending(false);
                    }}
                  >
                    {t("Xóa bộ lọc")}
                  </Button>
                )}
              </div>
            }
            columns={[
              ...(!personal
                ? [
                    {
                      label: t("Chọn"),
                      minWidth: 64,
                      render: (i: PerformanceView) => (
                        <Checkbox
                          aria-label={t("Chọn đánh giá của {0}", [
                            i.employeeName,
                          ])}
                          checked={selectedItems.some((r) => r.id === i.id)}
                          disabled={
                            !i.canReport ||
                            (selectedItems.length >= 20 &&
                              !selected.includes(i.id))
                          }
                          onChange={(e) =>
                            setSelected((ids) =>
                              e.target.checked
                                ? [...ids, i.id]
                                : ids.filter((id) => id !== i.id),
                            )
                          }
                        />
                      ),
                    },
                  ]
                : []),
              {
                label: t(personal ? "Kỳ đánh giá" : "Nhân viên / Kỳ đánh giá"),
                minWidth: 260,
                render: (i) => (
                  <div className="employment-person">
                    <Avatar name={i.employeeName} />
                    <div>
                      <strong>
                        {personal ? reviewTitle(i) : i.employeeName}
                      </strong>
                      <small>
                        {personal
                          ? i.employeeCode
                          : `${i.employeeCode} · ${reviewTitle(i)}`}
                      </small>
                    </div>
                  </div>
                ),
              },
              {
                label: t("Thời gian"),
                minWidth: 180,
                render: (i) => (
                  <div className="performance-list-dates">
                    <span>
                      {dayLabel(i.startDate)} — {dayLabel(i.endDate)}
                    </span>
                    {["self_review", "manager_review"].includes(i.status) && (
                      <small data-overdue={i.managerDue < today()}>
                        {t("Hạn: {0}", [dayLabel(i.managerDue)])}
                      </small>
                    )}
                  </div>
                ),
              },
              {
                label: t("Trạng thái"),
                minWidth: 195,
                render: (i) => <PerformanceBadge item={i} />,
              },
              {
                label: t("Kết quả"),
                minWidth: 100,
                render: (i) => (
                  <strong className="performance-list-score">
                    {i.managerAssessment?.submitted &&
                    i.managerAssessment?.score !== null &&
                    i.managerAssessment?.score !== undefined
                      ? `${i.managerAssessment.score}%`
                      : "—"}
                  </strong>
                ),
              },
              {
                label: t("Thao tác"),
                minWidth: 145,
                render: (i) => (
                  <Button variant="ghost" onClick={() => setDetail(i.id)}>
                    {t("Xem chi tiết")}
                    <ArrowUpRight size={16} />
                  </Button>
                ),
              },
            ]}
          />
        </>
      )}
      {section === "reports" && q.data && (
        <PerformanceReports workspace={q.data} onOpenReview={setDetail} />
      )}
      {reportEditor && q.data && (
        <PerformanceReportEditor
          workspace={q.data}
          items={selectedItems}
          onClose={() => setReportEditor(false)}
          onSaved={() => {
            setReportEditor(false);
            setSelected([]);
            setSection("reports");
          }}
        />
      )}
      {editor && q.data && (
        <PerformanceEditor
          item={editor === "new" ? undefined : editor}
          workspace={q.data}
          onClose={() => setEditor(null)}
        />
      )}
      {detail && (
        <PerformanceDetail
          item={detail}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setEditor(detail);
            setDetail(null);
          }}
          onAction={(a) => {
            setAction({ item: detail, action: a });
            setDetail(null);
          }}
        />
      )}
      {action &&
        (action.action === "self" || action.action === "manager" ? (
          <PerformanceAssessmentDialog
            item={action.item}
            phase={action.action}
            onClose={() => {
              setDetail(action.item.id);
              setAction(null);
            }}
          />
        ) : (
          <PerformanceDecision
            {...action}
            onClose={() => {
              setDetail(action.item.id);
              setAction(null);
            }}
          />
        ))}
    </div>
  );
}
