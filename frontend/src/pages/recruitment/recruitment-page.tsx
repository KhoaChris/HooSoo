import { StableText } from "../../i18n/stable-text";
import { t, useLocale } from "../../i18n";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Plus,
  Search,
  SlidersHorizontal,
  BriefcaseBusiness,
} from "lucide-react";
import { isSupervisorRole, type Candidate } from "@hoosoo/shared";
import { useAuth } from "../../app/auth";
import { useApi } from "../../hooks/data";
import {
  Heading,
  Button,
  Select,
  Input,
  Modal,
  Loading,
  ErrorBox,
} from "../../components/ui";
import { JobEditor, type RecruitmentDirectory } from "./job-editor";
import {
  CandidateCreate,
  CandidateDetail,
  CandidateActionDialog,
  type CandidateAction,
} from "./candidate-dialogs";
import { RecruitmentBoard } from "./recruitment-board";
import { candidateMovement } from "./candidate-movement";
export function RecruitmentPage() {
  useLocale();
  const [searchParams] = useSearchParams();
  const { me } = useAuth(),
    hr = me?.actor.role === "Admin" || me?.actor.role === "HR";
  const directory = useApi<RecruitmentDirectory>("/recruitment/jobs");
  const [jobId, setJobId] = useState(() => searchParams.get("job") ?? ""),
    [editJob, setEditJob] = useState<"new" | "edit" | null>(null),
    [create, setCreate] = useState<"new" | "sample" | null>(null),
    [editCandidate, setEditCandidate] = useState<Candidate | null>(null),
    [search, setSearch] = useState(""),
    [detailId, setDetailId] = useState<string | null>(null),
    [detailTab, setDetailTab] = useState<"profile" | "rounds">("profile"),
    [action, setAction] = useState<{
      candidate: Candidate;
      action: CandidateAction;
      targetId?: string;
    } | null>(null);
  const job =
    directory.data?.items.find((j) => j.id === jobId) ??
    directory.data?.items[0];
  const candidates = useApi<{ items: Candidate[] }>(
    job
      ? `/recruitment/jobs/${job.id}/candidates`
      : "/recruitment/jobs/none/candidates",
    !!job,
  );
  const rows = candidates.data?.items ?? [],
    filtered = rows.filter((c) =>
      `${c.name} ${c.email}`
        .toLocaleLowerCase("vi")
        .includes(search.toLocaleLowerCase("vi")),
    ),
    detail = rows.find((c) => c.id === detailId);
  const canManage = !!(
    me &&
    job &&
    (hr ||
      (isSupervisorRole(me.actor.role) &&
        job.hiringManagerId === me.actor.employeeId &&
        job.departmentId === me.employee.departmentId))
  );
  const openAction = (c: Candidate, a: CandidateAction, targetId?: string) => {
    if (a === "move" && (!job || !candidateMovement(c, job, canManage).allowed))
      return;
    setDetailId(null);
    setAction({
      candidate: structuredClone(c),
      action: a,
      targetId:
        a === "move"
          ? (targetId ?? candidateMovement(c, job!, canManage).next?.id)
          : undefined,
    });
  };
  return (
    <>
      <Heading
        title={t("Theo dõi tuyển dụng")}
        action={
          hr && (
            <Button onClick={() => setEditJob("new")}>
              <Plus size={17} />
              {t("Mở đợt tuyển dụng")}
            </Button>
          )
        }
      />
      <ErrorBox
        error={directory.error}
        retry={() => void directory.refetch()}
      />
      {directory.isPending ? (
        <Loading />
      ) : directory.error && !directory.data ? null : !job ? (
        <div className="recruitment-empty">
          <BriefcaseBusiness size={34} />
          <h2>
            <StableText>{t("Chưa có đợt tuyển dụng")}</StableText>
          </h2>
          {hr && (
            <Button onClick={() => setEditJob("new")}>
              {t("Tạo đợt tuyển dụng đầu tiên")}
            </Button>
          )}
        </div>
      ) : (
        <>
          <section className="recruitment-toolbar">
            <div className="recruitment-job">
              <span className="section-eyebrow">
                <StableText>{t("ĐỢT TUYỂN DỤNG")}</StableText>
              </span>
              <Select
                aria-label={t("Chọn đợt tuyển dụng")}
                value={job.id}
                onValueChange={(v) => {
                  setJobId(v);
                  setSearch("");
                }}
                options={directory.data!.items.map((j) => ({
                  value: j.id,
                  label: j.title + (j.active ? "" : t(" · Đã đóng")),
                }))}
              />
              <p>
                {
                  directory.data?.departments.find(
                    (d) => d.id === job.departmentId,
                  )?.name
                }{" "}
                · {rows.filter((c) => c.status === "hired").length}/
                {job.openings} <StableText>{t("vị trí đã tuyển")}</StableText>
              </p>
            </div>
            <div className="row-actions">
              {hr && (
                <Button variant="secondary" onClick={() => setEditJob("edit")}>
                  <SlidersHorizontal size={16} />
                  {t("Quy trình")}
                </Button>
              )}
              {hr && job.active && (
                <Button onClick={() => setCreate("new")}>
                  <Plus size={16} />
                  {t("Tiếp nhận ứng viên")}
                </Button>
              )}
            </div>
          </section>
          <div className="recruitment-filters">
            <label className="search-input">
              <Search size={16} />
              <Input
                placeholder={t("Tìm tên hoặc email ứng viên…")}
                aria-label={t("Tìm ứng viên")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <span>
              {filtered.length} <StableText>{t("hồ sơ ·")}</StableText>{" "}
              {job.stages.length}{" "}
              <StableText>{t("vòng tuyển dụng")}</StableText>
            </span>
            {hr && job.active && (
              <Button variant="ghost" onClick={() => setCreate("sample")}>
                {t("Tạo hồ sơ mẫu")}
              </Button>
            )}
          </div>
          <ErrorBox
            error={candidates.error}
            retry={() => void candidates.refetch()}
          />
          {candidates.isPending ? (
            <Loading />
          ) : (
            <RecruitmentBoard
              key={job.id}
              job={job}
              candidates={filtered}
              canManage={canManage}
              onOpen={(id, tab = "profile") => {
                setDetailTab(tab);
                setDetailId(id);
              }}
              onMove={(candidate, targetId) =>
                openAction(candidate, "move", targetId)
              }
            />
          )}
        </>
      )}
      {editJob && directory.data && (
        <Modal
          title={
            editJob === "new"
              ? t("Mở đợt tuyển dụng")
              : t("Thiết lập đợt tuyển dụng")
          }
          size="wide"
          onClose={() => setEditJob(null)}
        >
          <JobEditor
            job={editJob === "edit" ? job : undefined}
            directory={directory.data}
            onSaved={(id) => {
              setJobId(id);
              setEditJob(null);
            }}
          />
        </Modal>
      )}
      {create && job && (
        <CandidateCreate
          job={job}
          sample={create === "sample"}
          onClose={() => setCreate(null)}
        />
      )}
      {editCandidate && job && (
        <CandidateCreate
          job={job}
          sample={false}
          candidate={editCandidate}
          onClose={() => setEditCandidate(null)}
        />
      )}
      {detail && job && (
        <CandidateDetail
          key={detail.id}
          initialTab={detailTab}
          candidate={detail}
          job={job}
          hr={hr}
          onClose={() => setDetailId(null)}
          onEdit={() => {
            setEditCandidate(structuredClone(detail));
            setDetailId(null);
          }}
          onAction={(a) => openAction(detail, a)}
        />
      )}
      {action && job && directory.data && (
        <CandidateActionDialog
          candidate={action.candidate}
          action={action.action}
          moveTargetId={action.targetId}
          currentCandidate={rows.find((c) => c.id === action.candidate.id)}
          canMove={canManage}
          job={job}
          directory={directory.data}
          interviewLocations={rows.flatMap((candidate) =>
            candidate.rounds.flatMap((round) =>
              round.interview?.location ? [round.interview.location] : [],
            ),
          )}
          onClose={() => setAction(null)}
        />
      )}
    </>
  );
}
