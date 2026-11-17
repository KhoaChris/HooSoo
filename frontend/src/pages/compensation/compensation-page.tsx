import { WorkforceLinks } from "../workforce/common";
import { useAuth } from "../../app/auth";
import { AdminBandDialog } from "./admin-band-dialog";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  WalletCards,
  ArrowUpRight,
  Plus,
  CalendarDays,
} from "lucide-react";
import {
  monthlyPackageTotal,
  type CompensationWorkspace,
  type CompensationPerson,
  type CompensationView,
} from "@hoosoo/shared";
import { useApi } from "../../hooks/data";
import {
  Button,
  DataTable,
  ErrorBox,
  Heading,
  Input,
  Loading,
  Modal,
} from "../../components/ui";
import { Avatar } from "../../components/ui/avatar";
import { t, useLocale } from "../../i18n";
import { dayLabel } from "../workflows/workflow-ui";
import { moneyLabel } from "./compensation-model";
import {
  CompensationEditor,
  CompensationDecision,
} from "./compensation-editor";
import {
  CompensationDetail,
  CompensationBadge,
  PackageSummary,
} from "./compensation-detail";
export function CompensationPage({ personal = false }: { personal?: boolean }) {
  useLocale();
  const { me } = useAuth();
  const isAdmin = me?.actor.role === "Admin";
  const [bandOpen, setBandOpen] = useState(false);
  const [params] = useSearchParams(),
    filterId = personal ? "" : params.get("employeeId");
  const q = useApi<CompensationWorkspace>(
    `/compensation?scope=${personal ? "my" : "team"}${filterId ? `&employeeId=${encodeURIComponent(filterId)}` : ""}`,
  );
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [personId, setPersonId] = useState<string | null>(filterId),
    [detailId, setDetailId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{
      person: CompensationPerson;
      record?: CompensationView;
    } | null>(null),
    [decision, setDecision] = useState<{
      person: CompensationPerson;
      record: CompensationView;
      action: "publish" | "cancel";
    } | null>(null);
  const people = q.data?.people ?? [],
    person = personal ? people[0] : people.find((p) => p.id === personId),
    detail = person?.records.find((r) => r.id === detailId),
    current = person?.records.find((r) => r.phase === "current");
  const rows = people.filter((p) =>
      `${p.name} ${p.employeeCode}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
    ),
    currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / 10)));
  const historyPanel = person ? (
    <section className="compensation-history-section">
      <header>
        <div>
          <h2>{personal ? t("Lịch sử chế độ đãi ngộ") : person.name}</h2>
          {!personal && <small>{person.employeeCode}</small>}
        </div>
        {person.canManage && (
          <Button onClick={() => setEditor({ person })}>
            <Plus size={16} />
            {t("Tạo điều chỉnh")}
          </Button>
        )}
      </header>
      {!person.records.length && (
        <p className="compensation-empty">{t("Chưa có hồ sơ lương.")}</p>
      )}
      <ol className="compensation-history-list">
        {person.records.map((record) => (
          <li key={record.id}>
            <div>
              <strong>{moneyLabel(monthlyPackageTotal(record.package))}</strong>
              <small>
                {t("Hiệu lực từ")} {dayLabel(record.effectiveDate)}
              </small>
            </div>
            {personal && q.data?.adminBand ? (
              <span
                className="compensation-badge status-tone"
                data-tone="neutral"
              >
                {t("Hồ sơ trước band")}
              </span>
            ) : (
              <CompensationBadge record={record} />
            )}
            <Button variant="ghost" onClick={() => setDetailId(record.id)}>
              {t("Xem chi tiết")}
              <ArrowUpRight size={16} />
            </Button>
          </li>
        ))}
      </ol>
    </section>
  ) : null;
  return (
    <div className="compensation-page">
      <Heading
        title={t(personal ? "Lương & phúc lợi của tôi" : "Lương & phúc lợi")}
        action={
          isAdmin && (
            <Button variant="secondary" onClick={() => setBandOpen(true)}>
              {t("Cấu hình band Admin")}
            </Button>
          )
        }
      />
      <WorkforceLinks group="payroll" personal={personal} />
      {personal ? (
        q.isPending ? (
          <Loading />
        ) : q.error ? (
          <ErrorBox error={q.error} retry={() => void q.refetch()} />
        ) : isAdmin && q.data?.adminBand ? (
          <section className="compensation-current">
            <div className="compensation-record-bar">
              <strong>{t("Band lương Admin")}</strong>
              <span>
                {t("Người cập nhật")}: {q.data.adminBand.changedByName}
              </span>
            </div>
            <PackageSummary value={q.data.adminBand.package} />
          </section>
        ) : current ? (
          <section className="compensation-current">
            <div className="compensation-record-bar">
              <CompensationBadge record={current} />
              <span>
                <CalendarDays size={16} />
                {t("Hiệu lực từ")} {dayLabel(current.effectiveDate)}
              </span>
            </div>
            <PackageSummary value={current.package} />
          </section>
        ) : (
          <p className="compensation-empty">
            {t(
              isAdmin
                ? "Chưa thiết lập band Admin."
                : "Chưa có chế độ đãi ngộ được công bố.",
            )}
          </p>
        )
      ) : (
        <DataTable
          title={t("Chế độ đãi ngộ nhân viên")}
          icon={<WalletCards size={19} />}
          data={
            q.data
              ? {
                  items: rows.slice((currentPage - 1) * 10, currentPage * 10),
                  total: rows.length,
                  page: currentPage,
                  pageSize: 10,
                }
              : undefined
          }
          loading={q.isPending}
          error={q.error}
          onRetry={() => void q.refetch()}
          onPage={setPage}
          filtered={!!search}
          toolbar={
            <label className="search-input">
              <Search size={17} />
              <Input
                aria-label={t("Tìm nhân viên")}
                placeholder={t("Tên hoặc mã nhân viên…")}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </label>
          }
          columns={[
            {
              label: t("Nhân viên"),
              minWidth: 210,
              render: (p) => (
                <div className="employment-person">
                  <Avatar name={p.name} />
                  <div>
                    <strong>{p.name}</strong>
                    <small>{p.employeeCode}</small>
                  </div>
                </div>
              ),
            },
            {
              label: t("Lương cơ bản"),
              minWidth: 150,
              render: (p) => {
                const r = p.records.find((r) => r.phase === "current");
                return r ? moneyLabel(r.package.baseSalary) : "—";
              },
            },
            {
              label: t("Tổng cố định / tháng"),
              minWidth: 170,
              render: (p) => {
                const r = p.records.find((r) => r.phase === "current");
                return r ? (
                  <strong className="compensation-table-total">
                    {moneyLabel(monthlyPackageTotal(r.package))}
                  </strong>
                ) : (
                  "—"
                );
              },
            },
            {
              label: t("Điều chỉnh"),
              minWidth: 140,
              render: (p) => {
                const next = p.records
                  .filter((r) => r.phase === "scheduled")
                  .at(-1);
                return next ? (
                  <span>
                    {t("Từ ngày")} {dayLabel(next.effectiveDate)}
                  </span>
                ) : p.records.some((r) => r.phase === "draft") ? (
                  t("Có bản nháp")
                ) : (
                  "—"
                );
              },
            },
            {
              label: t("Thao tác"),
              minWidth: 150,
              render: (p) => (
                <Button variant="ghost" onClick={() => setPersonId(p.id)}>
                  {t("Xem chi tiết")}
                  <ArrowUpRight size={16} />
                </Button>
              ),
            },
          ]}
        />
      )}
      {bandOpen && <AdminBandDialog onClose={() => setBandOpen(false)} />}
      {person &&
        (personal ? (
          person.records.length > 0 ? (
            historyPanel
          ) : null
        ) : !detail && !editor && !decision ? (
          <Modal
            title={person.name}
            description={person.employeeCode}
            icon={<WalletCards size={22} />}
            size="wide"
            className="compensation-dialog"
            onClose={() => setPersonId(null)}
          >
            {historyPanel}
          </Modal>
        ) : null)}
      {detail && person && !editor && !decision && (
        <CompensationDetail
          person={person}
          record={detail}
          onClose={() => setDetailId(null)}
          onEdit={(record) => setEditor({ person, record })}
          onAction={(action) => setDecision({ person, record: detail, action })}
        />
      )}
      {editor && (
        <CompensationEditor
          {...editor}
          onClose={() => {
            setEditor(null);
            setDetailId(null);
          }}
        />
      )}
      {decision && (
        <CompensationDecision
          {...decision}
          onClose={() => {
            setDecision(null);
            setDetailId(null);
          }}
        />
      )}
    </div>
  );
}
