import { useState } from "react";
import {
  Plus,
  Search,
  SlidersHorizontal,
  ArrowRight,
  CalendarDays,
  GripVertical,
  BriefcaseBusiness,
} from "lucide-react";
import type { Candidate } from "@hoosoo/shared";
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
import { dayLabel } from "../workflows/workflow-ui";
export function RecruitmentPage() {
  const { me } = useAuth(),
    hr = me?.actor.role === "Admin" || me?.actor.role === "HR";
  const directory = useApi<RecruitmentDirectory>("/recruitment/jobs");
  const [jobId, setJobId] = useState(""),
    [editJob, setEditJob] = useState<"new" | "edit" | null>(null),
    [create, setCreate] = useState<"new" | "sample" | null>(null),
    [editCandidate, setEditCandidate] = useState<Candidate | null>(null),
    [search, setSearch] = useState(""),
    [detailId, setDetailId] = useState<string | null>(null),
    [action, setAction] = useState<{
      candidate: Candidate;
      action: CandidateAction;
    } | null>(null),
    [dragId, setDragId] = useState<string | null>(null),
    [notice, setNotice] = useState("");
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
  const openAction = (c: Candidate, a: CandidateAction) => {
    setDetailId(null);
    setAction({ candidate: structuredClone(c), action: a });
  };
  const canMove = (c: Candidate, target: string) =>
    job?.active &&
    c.status === "active" &&
    c.rounds.find((r) => r.stageId === c.stageId)?.result === "passed" &&
    job.stages[job.stages.findIndex((s) => s.id === c.stageId) + 1]?.id ===
      target;
  return (
    <>
      <Heading
        title="Theo dõi tuyển dụng"
        description="Từ tiếp nhận hồ sơ đến quyết định tuyển dụng, trong một quy trình thống nhất."
        action={
          hr && (
            <Button onClick={() => setEditJob("new")}>
              <Plus size={17} />
              Mở đợt tuyển dụng
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
          <h2>Chưa có đợt tuyển dụng</h2>
          <p>
            {hr
              ? "Thiết lập vị trí và các vòng phỏng vấn để bắt đầu tiếp nhận ứng viên."
              : "Các đợt tuyển dụng bạn phụ trách sẽ xuất hiện tại đây."}
          </p>
          {hr && (
            <Button onClick={() => setEditJob("new")}>
              Tạo đợt tuyển dụng đầu tiên
            </Button>
          )}
        </div>
      ) : (
        <>
          <section className="recruitment-toolbar">
            <div className="recruitment-job">
              <span className="section-eyebrow">ĐỢT TUYỂN DỤNG</span>
              <Select
                aria-label="Chọn đợt tuyển dụng"
                value={job.id}
                onValueChange={(v) => {
                  setJobId(v);
                  setSearch("");
                  setNotice("");
                }}
                options={directory.data!.items.map((j) => ({
                  value: j.id,
                  label: j.title + (j.active ? "" : " · Đã đóng"),
                }))}
              />
              <p>
                {
                  directory.data?.departments.find(
                    (d) => d.id === job.departmentId,
                  )?.name
                }{" "}
                · {rows.filter((c) => c.status === "hired").length}/
                {job.openings} vị trí đã tuyển
              </p>
            </div>
            <div className="row-actions">
              {hr && (
                <Button variant="secondary" onClick={() => setEditJob("edit")}>
                  <SlidersHorizontal size={16} />
                  Quy trình
                </Button>
              )}
              {hr && job.active && (
                <Button onClick={() => setCreate("new")}>
                  <Plus size={16} />
                  Tiếp nhận ứng viên
                </Button>
              )}
            </div>
          </section>
          <div className="recruitment-filters">
            <label className="search-input">
              <Search size={16} />
              <Input
                placeholder="Tìm tên hoặc email ứng viên…"
                aria-label="Tìm ứng viên"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <span>
              {filtered.length} hồ sơ · {job.stages.length} vòng tuyển dụng
            </span>
            {hr && job.active && (
              <Button variant="ghost" onClick={() => setCreate("sample")}>
                Tạo hồ sơ mẫu
              </Button>
            )}
          </div>
          <ErrorBox
            error={candidates.error}
            retry={() => void candidates.refetch()}
          />
          {notice && (
            <p className="workflow-notice" role="status">
              {notice}
            </p>
          )}
          {candidates.isPending ? (
            <Loading />
          ) : (
            <div className="kanban-scroll" aria-label="Quy trình tuyển dụng">
              <div className="kanban-board">
                {[
                  ...job.stages.map((s, i) => ({ ...s, step: i + 1 })),
                  {
                    id: "hired",
                    name: "Trúng tuyển",
                    kind: "terminal",
                    step: 0,
                  },
                  {
                    id: "rejected",
                    name: "Không tiếp tục",
                    kind: "terminal",
                    step: 0,
                  },
                ].map((stage) => {
                  const items = filtered.filter((c) =>
                      stage.kind === "terminal"
                        ? c.status === stage.id
                        : c.status === "active" && c.stageId === stage.id,
                    ),
                    dragged = rows.find((c) => c.id === dragId),
                    allowed = dragged && canMove(dragged, stage.id);
                  return (
                    <section
                      className={`kanban-column ${allowed ? "can-drop" : ""}`}
                      key={stage.id}
                      onDragOver={(e) => {
                        if (allowed) {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragged && allowed) openAction(dragged, "move");
                        else
                          setNotice(
                            "Chỉ chuyển sang vòng kế tiếp sau khi đánh giá đạt ở vòng hiện tại.",
                          );
                        setDragId(null);
                      }}
                    >
                      <header>
                        <div>
                          {stage.step > 0 ? (
                            <span className="kanban-step">
                              {String(stage.step).padStart(2, "0")}
                            </span>
                          ) : (
                            <span
                              className={`kanban-terminal terminal-${stage.id}`}
                            />
                          )}
                          <h3>{stage.name}</h3>
                        </div>
                        <span className="kanban-count">{items.length}</span>
                      </header>
                      <div className="kanban-cards">
                        {items.map((c) => {
                          const round = c.rounds.find(
                              (r) => r.stageId === c.stageId,
                            ),
                            next =
                              job.stages[
                                job.stages.findIndex(
                                  (s) => s.id === c.stageId,
                                ) + 1
                              ],
                            movable = !!next && canMove(c, next.id);
                          return (
                            <article
                              className={`candidate-card ${movable ? "is-draggable" : ""}`}
                              key={c.id}
                              draggable={movable}
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", c.id);
                                e.dataTransfer.effectAllowed = "move";
                                setDragId(c.id);
                                setNotice(`Kéo ${c.name} sang ${next?.name}.`);
                              }}
                              onDragEnd={() => {
                                setDragId(null);
                                setNotice("");
                              }}
                            >
                              <div className="candidate-card-top">
                                <span className="candidate-initial">
                                  {c.name
                                    .trim()
                                    .split(/\s+/)
                                    .slice(-2)
                                    .map((n) => n[0])
                                    .join("")}
                                </span>
                                {c.source === "sample" && (
                                  <small className="sample-label">
                                    Hồ sơ mẫu
                                  </small>
                                )}
                                {movable && (
                                  <GripVertical
                                    size={16}
                                    aria-label="Có thể kéo sang vòng tiếp theo"
                                  />
                                )}
                              </div>
                              <button
                                className="candidate-open"
                                onClick={() => setDetailId(c.id)}
                              >
                                <strong>{c.name}</strong>
                                <span>{c.email}</span>
                              </button>
                              {round?.interview && (
                                <div className="candidate-card-interview">
                                  <CalendarDays size={14} />
                                  <span>
                                    {dayLabel(round.interview.date)} ·{" "}
                                    {round.interview.start}
                                    <small>
                                      {round.interview.status === "confirmed"
                                        ? "Đã duyệt lịch"
                                        : "Chờ duyệt lịch"}
                                    </small>
                                  </span>
                                </div>
                              )}
                              <footer>
                                <span
                                  className={`candidate-result ${round?.result ?? ""}`}
                                >
                                  {c.status === "hired"
                                    ? "Đã trúng tuyển"
                                    : c.status === "rejected"
                                      ? "Đã kết thúc"
                                      : round?.result === "passed"
                                        ? "Đạt yêu cầu"
                                        : round?.result === "failed"
                                          ? "Chưa đạt"
                                          : "Chưa đánh giá"}
                                </span>
                                {movable && (
                                  <Button
                                    variant="ghost"
                                    aria-label={`Chuyển vòng cho ${c.name}`}
                                    onClick={() => openAction(c, "move")}
                                  >
                                    <ArrowRight size={16} />
                                  </Button>
                                )}
                              </footer>
                            </article>
                          );
                        })}
                        {!items.length && (
                          <div className="kanban-empty">
                            {allowed
                              ? "Thả ứng viên vào đây"
                              : "Chưa có ứng viên"}
                          </div>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          )}
          <p className="workflow-help">
            Đánh giá đạt để chuyển sang vòng kế tiếp. Bạn có thể kéo thả hoặc
            dùng nút mũi tên trên hồ sơ. Lịch phỏng vấn cần được nhân sự xác
            nhận.
          </p>
        </>
      )}
      {editJob && directory.data && (
        <Modal
          title={
            editJob === "new" ? "Mở đợt tuyển dụng" : "Thiết lập đợt tuyển dụng"
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
          job={job}
          directory={directory.data}
          onClose={() => setAction(null)}
        />
      )}
    </>
  );
}
