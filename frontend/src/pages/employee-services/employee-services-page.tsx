import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search, Download, ArrowUpRight } from "lucide-react";
import {
  serviceSections,
  serviceSectionLabels,
  serviceStatusLabels,
  type ServiceSection,
  type ServiceView,
  type ServiceWorkspace,
} from "@hoosoo/shared";
import { useApi } from "../../hooks/data";
import { Button, Heading, DataTable, Input, Select } from "../../components/ui";
import { t, useLocale } from "../../i18n";
import { dayLabel } from "../workflows/workflow-ui";
import {
  ServiceEditor,
  ServiceDecisionDialog,
  serviceIcons,
  serviceCreateLabels,
  type ServiceDecision,
} from "./service-editor";
import { ServiceDetail, ServiceBadge } from "./service-detail";
import { safeCsv } from "./service-model";
export function EmployeeServicesPage({
  personal = false,
}: {
  personal?: boolean;
}) {
  useLocale();
  const [params, setParams] = useSearchParams(),
    requested = params.get("tab") as ServiceSection,
    section = serviceSections.includes(requested) ? requested : "assets";
  const q = useApi<ServiceWorkspace>(
    `/employee-services?section=${section}&scope=${personal ? "my" : "team"}`,
  );
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1),
    [editor, setEditor] = useState<ServiceView | "new" | null>(null),
    [detailId, setDetailId] = useState<string | null>(params.get("record")),
    [decision, setDecision] = useState<ServiceDecision | null>(null);
  const all = q.data?.items ?? [],
    rows = all.filter(
      (r) =>
        (!status || r.status === status) &&
        `${r.title} ${r.employeeName} ${r.employeeCode} ${r.assetCode}`
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase()),
    ),
    current = Math.min(page, Math.max(1, Math.ceil(rows.length / 12))),
    detail = all.find((x) => x.id === detailId),
    Icon = serviceIcons[section];
  function exportRows() {
    const csv = safeCsv([
      [
        t("Mã nhân viên"),
        t("Nhân viên"),
        t("Nội dung"),
        t("Mã tài sản"),
        t("Bắt đầu"),
        t("Kết thúc"),
        t("Trạng thái"),
      ],
      ...rows.map((r) => [
        r.employeeCode,
        r.employeeName,
        r.title,
        r.assetCode,
        r.startDate,
        r.endDate,
        t(serviceStatusLabels[r.status]),
      ]),
    ]);
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `hoosoo-${section}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="employee-services-page">
      <Heading
        title={t(personal ? "Tài sản & phát triển của tôi" : "Dịch vụ nhân sự")}
        action={
          <div className="row-actions">
            <Button
              variant="secondary"
              disabled={!rows.length}
              onClick={exportRows}
            >
              <Download size={16} />
              {t("Xuất CSV")}
            </Button>
            {q.data?.canCreate && (
              <Button
                disabled={!q.data.people.length}
                onClick={() => setEditor("new")}
              >
                <Plus size={16} />
                {t(serviceCreateLabels[section])}
              </Button>
            )}
          </div>
        }
      />
      <nav className="employment-tabs" aria-label={t("Dịch vụ nhân sự")}>
        {serviceSections.map((s) => {
          const TabIcon = serviceIcons[s];
          return (
            <button
              key={s}
              aria-current={s === section ? "page" : undefined}
              onClick={() => {
                setParams({ tab: s });
                setSearch("");
                setStatus("");
                setPage(1);
                setDetailId(null);
              }}
            >
              <TabIcon size={18} />
              <span>{t(serviceSectionLabels[s])}</span>
            </button>
          );
        })}
      </nav>
      <DataTable
        title={t(serviceSectionLabels[section])}
        icon={<Icon size={20} />}
        loading={q.isPending}
        error={q.error}
        onRetry={() => void q.refetch()}
        filtered={!!search || !!status}
        data={
          q.data
            ? {
                items: rows.slice((current - 1) * 12, current * 12),
                total: rows.length,
                page: current,
                pageSize: 12,
              }
            : undefined
        }
        onPage={setPage}
        toolbar={
          <div className="filters">
            <label className="search-input">
              <Search size={17} />
              <Input
                aria-label={t("Tìm hồ sơ")}
                placeholder={t("Tìm tên, mã hoặc nội dung…")}
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
                ...Array.from(new Set(all.map((r) => r.status))).map(
                  (value) => ({ value, label: t(serviceStatusLabels[value]) }),
                ),
              ]}
            />
          </div>
        }
        columns={[
          {
            label: t("Nhân viên"),
            minWidth: 180,
            render: (r) => (
              <div className="service-person">
                <strong>{r.employeeName}</strong>
                <small>{r.employeeCode}</small>
              </div>
            ),
          },
          {
            label: t("Nội dung"),
            minWidth: 220,
            render: (r) => (
              <div className="service-person">
                <strong>{r.title}</strong>
                <small>
                  {r.assetCode ||
                    r.provider ||
                    (r.section === "offboarding"
                      ? `${r.tasks.filter((t) => t.completedAt).length}/${r.tasks.length} ${t("mục bàn giao")}`
                      : "")}
                </small>
              </div>
            ),
          },
          {
            label: t(
              section === "offboarding" ? "Ngày làm việc cuối" : "Thời gian",
            ),
            minWidth: 170,
            render: (r) =>
              section === "offboarding"
                ? dayLabel(r.endDate)
                : `${dayLabel(r.startDate)}${r.endDate ? ` – ${dayLabel(r.endDate)}` : ""}`,
          },
          {
            label: t("Trạng thái"),
            minWidth: 150,
            render: (r) => <ServiceBadge item={r} />,
          },
          {
            label: t("Chi tiết"),
            minWidth: 120,
            align: "right",
            render: (r) => (
              <Button variant="ghost" onClick={() => setDetailId(r.id)}>
                {t("Xem hồ sơ")}
                <ArrowUpRight size={15} />
              </Button>
            ),
          },
        ]}
      />
      <div className="service-related">
        <Link
          className="text-link"
          to={personal ? "/requests/my" : "/requests/approvals"}
        >
          {t("Phiếu đề nghị")}
          <ArrowUpRight size={16} />
        </Link>
        <Link
          className="text-link"
          to={personal ? "/employment/my" : "/employment"}
        >
          {t("Hợp đồng & hành trình")}
          <ArrowUpRight size={16} />
        </Link>
      </div>
      {editor && q.data && (
        <ServiceEditor
          section={section}
          item={editor === "new" ? undefined : editor}
          workspace={q.data}
          onClose={() => setEditor(null)}
        />
      )}
      {decision && (
        <ServiceDecisionDialog
          decision={decision}
          onClose={() => setDecision(null)}
        />
      )}
      {detail && !editor && !decision && (
        <ServiceDetail
          item={detail}
          personal={personal}
          onClose={() => setDetailId(null)}
          onEdit={() => setEditor(detail)}
          onAction={setDecision}
        />
      )}
    </div>
  );
}
