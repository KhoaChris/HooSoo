import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FileText,
  ListChecks,
  UserCheck,
  Plus,
  Search,
  ArrowUpRight,
} from "lucide-react";
import {
  employmentSections,
  employmentStatusLabels,
  onboardingProgress,
  type EmploymentSection,
  type EmploymentView,
  type EmploymentWorkspace,
  type EmploymentAction,
  type OnboardingPlan,
} from "@hoosoo/shared";
import { useAuth } from "../../app/auth";
import { useApi } from "../../hooks/data";
import { Heading, DataTable, Button, Input, Select } from "../../components/ui";
import { EmploymentBadge } from "./employment-badge";
import { Avatar } from "../../components/ui/avatar";
import { t, useLocale } from "../../i18n";
import { dayLabel, today } from "../workflows/workflow-ui";
import { EmploymentEditor, EmploymentDecision } from "./employment-editor";
import { EmploymentDetail } from "./employment-detail";
import { sectionLabels, itemStatus, itemLabel } from "./employment-model";
export function EmploymentPage({ personal = false }: { personal?: boolean }) {
  useLocale();
  const { me } = useAuth(),
    [params, setParams] = useSearchParams();
  const hr = ["Admin", "HR"].includes(me!.actor.role);
  const sections = employmentSections.filter(
    (s) => personal || hr || s !== "contracts",
  );
  const requested = params.get("tab") as EmploymentSection;
  const section = sections.includes(requested)
    ? requested
    : personal
      ? "contracts"
      : "onboarding";
  const q = useApi<EmploymentWorkspace>(
    `/employment/${section}?scope=${personal ? "my" : "team"}`,
  );
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1);
  const [editor, setEditor] = useState<EmploymentView | "new" | null>(null),
    [detailId, setDetailId] = useState<string | null>(null),
    [decision, setDecision] = useState<{
      item: EmploymentView;
      action: EmploymentAction | "add-task";
    } | null>(null);
  const data = q.data,
    all = data?.items ?? [],
    detail = all.find((i) => i.id === detailId);
  const rows = all.filter(
    (i) =>
      (!status || itemStatus(section, i, today()) === status) &&
      `${i.employeeName} ${i.employeeCode} ${"title" in i ? i.title : ""}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / 12)));
  const icons = {
    contracts: FileText,
    probations: UserCheck,
    onboarding: ListChecks,
  };
  const Icon = icons[section];
  const statuses =
    section === "contracts"
      ? ["draft", "active", "expiring", "expired", "ended", "cancelled"]
      : section === "probations"
        ? ["in_progress", "in_review", "confirmed", "declined"]
        : ["in_progress", "completed"];
  return (
    <div className="employment-page">
      <Heading
        title={t(personal ? "Hành trình của tôi" : "Vòng đời nhân sự")}
        action={
          data?.canCreate && (
            <Button
              onClick={() => setEditor("new")}
              disabled={
                !data.people.some(
                  (p) => section !== "probations" || p.status === "probation",
                )
              }
            >
              <Plus size={17} />
              {t(
                section === "contracts"
                  ? "Thêm hợp đồng"
                  : section === "probations"
                    ? "Tạo kỳ thử việc"
                    : "Tạo checklist tiếp nhận",
              )}
            </Button>
          )
        }
      />
      <nav className="employment-tabs" aria-label={t("Hồ sơ làm việc")}>
        {sections.map((s) => {
          const TabIcon = icons[s];
          return (
            <button
              key={s}
              aria-current={s === section ? "page" : undefined}
              onClick={() => {
                setParams({ tab: s });
                setStatus("");
                setSearch("");
                setPage(1);
                setDetailId(null);
                setEditor(null);
                setDecision(null);
              }}
            >
              <TabIcon size={18} />
              <span>{t(sectionLabels[s])}</span>
            </button>
          );
        })}
      </nav>
      <DataTable
        filtered={!!search || !!status}
        title={t(sectionLabels[section])}
        icon={<Icon size={19} />}
        data={
          data
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
            <label className="search-input">
              <Search size={17} />
              <Input
                aria-label={t("Tìm hồ sơ làm việc")}
                placeholder={t("Tên, mã nhân viên hoặc hợp đồng…")}
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
                ...statuses.map((value) => ({
                  value,
                  label: t(employmentStatusLabels[value]),
                })),
              ]}
            />
          </div>
        }
        columns={[
          {
            label: t(personal ? "Hồ sơ" : "Nhân viên"),
            minWidth: 250,
            render: (i) => (
              <div className="employment-person">
                <Avatar name={i.employeeName} />
                <div>
                  <strong>
                    {personal && "title" in i ? i.title : i.employeeName}
                  </strong>
                  <small>
                    {personal
                      ? t(itemLabel(section, i))
                      : "title" in i
                        ? `${i.employeeCode} · ${i.title}`
                        : i.employeeCode}
                  </small>
                </div>
              </div>
            ),
          },
          {
            label: t(section === "onboarding" ? "Ngày tiếp nhận" : "Thời hạn"),
            minWidth: 180,
            render: (i) => (
              <div className="employment-dates">
                <span>{dayLabel(i.startDate)}</span>
                {"endDate" in i && (
                  <small>
                    {i.endDate ? dayLabel(i.endDate) : t("Không thời hạn")}
                  </small>
                )}
              </div>
            ),
          },
          {
            label: t(section === "onboarding" ? "Tiến độ" : "Trạng thái"),
            minWidth: 190,
            render: (i) =>
              section === "onboarding" ? (
                <div className="employment-list-progress">
                  <span>
                    {
                      (i as OnboardingPlan).tasks.filter((t) => t.completedAt)
                        .length
                    }
                    /{(i as OnboardingPlan).tasks.length}
                  </span>
                  <progress
                    className="employment-progress"
                    max={100}
                    value={onboardingProgress(i as OnboardingPlan)}
                    aria-label={t("Tiến độ tiếp nhận")}
                  />
                  <EmploymentBadge section={section} item={i} />
                </div>
              ) : (
                <EmploymentBadge section={section} item={i} />
              ),
          },
          {
            label: t("Thao tác"),
            minWidth: 140,
            render: (i) => (
              <Button variant="ghost" onClick={() => setDetailId(i.id)}>
                {t("Xem chi tiết")}
                <ArrowUpRight size={16} />
              </Button>
            ),
          },
        ]}
      />
      {editor && data && (
        <EmploymentEditor
          section={section}
          workspace={data}
          item={editor === "new" ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}
      {detail && (
        <EmploymentDetail
          section={section}
          item={detail}
          onClose={() => setDetailId(null)}
          onEdit={() => {
            setEditor(detail);
            setDetailId(null);
          }}
          onAction={(action) => {
            setDecision({ item: detail, action });
            setDetailId(null);
          }}
        />
      )}
      {decision && (
        <EmploymentDecision
          section={section}
          {...decision}
          onClose={() => {
            setDetailId(decision.item.id);
            setDecision(null);
          }}
        />
      )}
    </div>
  );
}
