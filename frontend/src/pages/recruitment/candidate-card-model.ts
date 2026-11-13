import type { Candidate, CandidateRound, RecruitmentJob } from "@hoosoo/shared";

const englishEvidence = /\b(?:english|ielts|toeic|toefl|cefr)\b|tiếng\s+anh/iu;
const clauses = (value: string) =>
  value
    .split(/[;\n|•]+/)
    .map((v) => v.trim())
    .filter(Boolean);

// Keep the applicant's exact wording, including negative or unverified claims.
// An absent language qualification must never become an inferred proficiency.
export function candidateEnglish(
  candidate: Pick<Candidate, "skills" | "education">,
) {
  return (
    [...clauses(candidate.skills), ...clauses(candidate.education)].find(
      (clause) => englishEvidence.test(clause),
    ) ?? null
  );
}

export function candidateSkills(skills: string) {
  return clauses(skills)
    .flatMap((clause) => clause.split(/[,]+/))
    .map((skill) => skill.trim())
    .filter((skill) => skill && !englishEvidence.test(skill));
}

export function candidateScore(round?: CandidateRound) {
  return round?.result &&
    Number.isInteger(round.score) &&
    round.score! >= 1 &&
    round.score! <= 5
    ? round.score!
    : null;
}

// A percentage representation of the recorded human screening score, not an
// automated CV match or a hiring probability. Later rounds cannot overwrite it.
export function candidateMatch(candidate: Candidate, job: RecruitmentJob) {
  const screening = job.stages.find((stage) => stage.kind === "screening");
  const round =
    candidate.jobId === job.id && screening
      ? candidate.rounds.find((item) => item.stageId === screening.id)
      : undefined;
  const score = candidateScore(round);
  if (score !== null && round?.assessment?.kind === "screening")
    return {
      score,
      percent: round.assessment.totalPercent,
      criterionCount: round.assessment.ratings.length,
    };
  return score === null ? null : { score, percent: score * 20 };
}

export function candidateCardModel(candidate: Candidate, job: RecruitmentJob) {
  const stage = job.stages.find((s) => s.id === candidate.stageId);
  const round = candidate.rounds.find((r) => r.stageId === candidate.stageId);
  const decision = [...candidate.history]
    .reverse()
    .find((event) =>
      candidate.status === "hired"
        ? event.action === "hired" || event.action === "direct_hired"
        : candidate.status === "rejected" && event.action === "rejected",
    );
  const previousStages = job.stages.slice(
    0,
    Math.max(
      0,
      job.stages.findIndex((s) => s.id === candidate.stageId),
    ),
  );
  return {
    kind:
      candidate.status === "active"
        ? (stage?.kind ?? "screening")
        : candidate.status,
    round,
    score: candidateScore(round),
    match: candidateMatch(candidate, job),
    english: candidateEnglish(candidate),
    skills: candidateSkills(candidate.skills),
    decision,
    previousStages: previousStages.map((s) => ({
      ...s,
      result: candidate.rounds.find((r) => r.stageId === s.id)?.result,
    })),
  };
}

export function candidateInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("vi");
}
