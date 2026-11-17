import { useAuth } from "../../app/auth";
import { useState } from "react";
import { z } from "zod";
import {
  GraduationCap,
  BriefcaseBusiness,
  Award,
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
} from "lucide-react";
import {
  emptyEmployeeBackground,
  educationEntrySchema,
  experienceEntrySchema,
  certificateEntrySchema,
  backgroundSkillsSchema,
  type EmployeeView,
  type EmployeeBackground,
  type BackgroundSection,
} from "@hoosoo/shared";
import { Button, Form, Modal, type FormField } from "../../components/ui";
import { useAction } from "../../hooks/data";
import { t, useLocale } from "../../i18n";
import {
  BackgroundPresetField,
  BackgroundSkillsField,
} from "./background-fields";
import {
  qualifications,
  studyFields,
  experiencePositions,
  certificateNames,
  certificateIssuers,
  presetLabel,
} from "./background-options";
import { BackgroundSkillGroups } from "./background-skills-display";
import "../../style/pages/employee-background.css";
import { RecruitmentBackground } from "./recruitment-background";

const sections = [
  {
    value: "experience",
    label: "Kinh nghiệm làm việc",
    Icon: BriefcaseBusiness,
    limit: 15,
  },
  {
    value: "education",
    label: "Học vấn & bằng cấp",
    Icon: GraduationCap,
    limit: 10,
  },
  { value: "skills", label: "Kỹ năng chuyên môn", Icon: Sparkles, limit: 30 },
  { value: "certificates", label: "Chứng chỉ", Icon: Award, limit: 20 },
] as const;
type EntrySection = Exclude<BackgroundSection, "skills">;
type EditorState = {
  section: BackgroundSection;
  index: number;
  remove?: boolean;
};
const years = () =>
  Array.from({ length: new Date().getFullYear() + 7 - 1900 }, (_, i) => {
    const year = String(new Date().getFullYear() + 6 - i);
    return { value: year, label: year };
  });
const period = (start: string, end: string) =>
  `${start} — ${end === "current" ? t("Hiện tại") : end}`;

export function EmployeeBackgroundSection({
  employee,
}: {
  employee: EmployeeView;
}) {
  useLocale();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saved, setSaved] = useState<{
    employeeId: string;
    background: EmployeeBackground;
  } | null>(null);
  if (employee.canEditBackground === undefined) return null;
  const remote = employee.background ?? emptyEmployeeBackground();
  // Keep the acknowledged version while a live refresh catches up. A second
  // editor must not start with the version from before our successful save.
  const background =
    saved?.employeeId === employee.id &&
    saved.background.version > remote.version
      ? saved.background
      : remote;
  return (
    <>
      <RecruitmentBackground
        background={background}
        canEdit={employee.canEditBackground}
      />
      {sections
        .filter(
          ({ value }) =>
            employee.canEditBackground ||
            background[value].length > 0 ||
            !background.recruitment?.[
              value === "certificates" ? "skills" : value
            ]?.trim(),
        )
        .map(({ value, label, Icon, limit }) => (
          <section
            className="employee-background-section"
            key={value}
            aria-labelledby={`background-${value}`}
          >
            <header className="employee-section-heading">
              <h2 id={`background-${value}`}>
                <Icon size={18} aria-hidden="true" />
                {t(label)}
              </h2>
              {employee.canEditBackground && (
                <Button
                  variant="ghost"
                  disabled={
                    value !== "skills" && background[value].length >= limit
                  }
                  onClick={() => setEditor({ section: value, index: -1 })}
                >
                  {value === "skills" ? (
                    <Pencil size={15} />
                  ) : (
                    <Plus size={15} />
                  )}
                  {t(value === "skills" ? "Cập nhật" : "Thêm")}
                </Button>
              )}
            </header>
            {background[value].length === 0 ? (
              <p className="employee-background-empty">
                {t(
                  background.recruitment?.[
                    value === "certificates" ? "skills" : value
                  ]?.trim()
                    ? "Nội dung gốc được giữ trong hồ sơ từ tuyển dụng bên trên."
                    : "Chưa cập nhật",
                )}
              </p>
            ) : value === "skills" ? (
              <BackgroundSkillGroups skills={background.skills} />
            ) : (
              <ol className="employee-background-list">
                {background[value].map((entry, index) => (
                  <li key={entry.id}>
                    <div className="employee-background-record">
                      {"company" in entry ? (
                        <>
                          <h3>
                            {presetLabel(entry.position, experiencePositions)}
                          </h3>
                          <p>{entry.company}</p>
                          <small>
                            {period(entry.startYear, entry.endYear)}
                          </small>
                          {entry.description && (
                            <p className="employee-background-description">
                              {entry.description}
                            </p>
                          )}
                        </>
                      ) : "school" in entry ? (
                        <>
                          <h3>
                            {presetLabel(entry.qualification, qualifications)}
                          </h3>
                          <p>
                            {entry.school}
                            {entry.field &&
                              ` · ${presetLabel(entry.field, studyFields)}`}
                          </p>
                          <small>
                            {period(entry.startYear, entry.endYear)}
                          </small>
                          {entry.description && (
                            <p className="employee-background-description">
                              {entry.description}
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <h3>{entry.name}</h3>
                          <p>{entry.issuer}</p>
                          {(entry.issuedYear || entry.expiresYear) && (
                            <small>
                              {entry.issuedYear &&
                                `${t("Năm cấp")}: ${entry.issuedYear}`}
                              {entry.issuedYear && entry.expiresYear && " · "}
                              {entry.expiresYear &&
                                `${t("Hết hạn")}: ${entry.expiresYear}`}
                            </small>
                          )}
                          {entry.credentialUrl && (
                            <a
                              className="text-link"
                              href={entry.credentialUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {t("Xem chứng chỉ")}
                              <ExternalLink size={14} aria-hidden="true" />
                            </a>
                          )}
                        </>
                      )}
                    </div>
                    {employee.canEditBackground && (
                      <div className="employee-background-actions">
                        <Button
                          variant="ghost"
                          aria-label={t("Chỉnh sửa {0}", [
                            "company" in entry
                              ? presetLabel(entry.position, experiencePositions)
                              : "school" in entry
                                ? presetLabel(
                                    entry.qualification,
                                    qualifications,
                                  )
                                : entry.name,
                          ])}
                          onClick={() => setEditor({ section: value, index })}
                        >
                          <Pencil size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          tone="danger"
                          aria-label={t("Xóa {0}", [
                            "company" in entry
                              ? presetLabel(entry.position, experiencePositions)
                              : "school" in entry
                                ? presetLabel(
                                    entry.qualification,
                                    qualifications,
                                  )
                                : entry.name,
                          ])}
                          onClick={() =>
                            setEditor({ section: value, index, remove: true })
                          }
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      {editor && (
        <BackgroundEditor
          key={`${editor.section}-${editor.index}-${editor.remove}`}
          employee={employee}
          background={background}
          editor={editor}
          onSaved={(background) =>
            setSaved({ employeeId: employee.id, background })
          }
          onClose={() => setEditor(null)}
        />
      )}
    </>
  );
}

function BackgroundEditor({
  employee,
  background: currentBackground,
  editor,
  onSaved,
  onClose,
}: {
  employee: EmployeeView;
  background: EmployeeBackground;
  editor: EditorState;
  onSaved: (background: EmployeeBackground) => void;
  onClose: () => void;
}) {
  const [background] = useState(() => structuredClone(currentBackground));
  const save = useAction();
  const { me } = useAuth();
  const actorId = me?.actor.employeeId;
  const { section, index, remove } = editor;
  const { label, Icon } = sections.find((s) => s.value === section)!;
  const entry = section === "skills" ? null : background[section][index];
  const endpoint = `/employees/${employee.id}/background`;
  // The caller chooses the personal route from the authenticated identity, never from an editable field.
  const persist = async (items: unknown[]) => {
    const updated = (await save.mutateAsync({
      path: employee.id === actorId ? "/me/background" : endpoint,
      method: "PATCH",
      body: { section, version: background.version, items },
    })) as EmployeeView;
    if (updated.background) onSaved(updated.background);
    onClose();
  };
  let fields: FormField[], defaults: Record<string, unknown>, schema: z.ZodType;
  const yearField = (
    name: string,
    label: string,
    required = true,
    ongoing = false,
  ): FormField => ({
    name,
    label,
    type: "select",
    required,
    options: [
      { value: "", label: t("Chọn năm"), disabled: required },
      ...(ongoing ? [{ value: "current", label: t("Hiện tại") }] : []),
      ...years(),
    ],
  });
  const presetField = (
    name: string,
    label: string,
    options: readonly string[],
    required = false,
  ): FormField => ({
    name,
    label,
    type: "select",
    required,
    render: (props) => (
      <BackgroundPresetField {...props} options={options} required={required} />
    ),
  });
  if (remove) {
    schema = z.object({}).strict();
    fields = [];
    defaults = {};
  } else if (section === "skills") {
    schema = z.object({ skills: backgroundSkillsSchema });
    defaults = { skills: background.skills };
    fields = [
      {
        name: "skills",
        label: "Kỹ năng chuyên môn",
        render: (props) => <BackgroundSkillsField {...props} />,
      },
    ];
  } else {
    const shared = {
      id: crypto.randomUUID(),
      startYear: "",
      endYear: "current",
      description: "",
    };
    schema =
      section === "education"
        ? educationEntrySchema
        : section === "experience"
          ? experienceEntrySchema
          : certificateEntrySchema;
    defaults = entry
      ? { ...entry }
      : section === "education"
        ? { ...shared, school: "", qualification: "", field: "" }
        : section === "experience"
          ? { ...shared, company: "", position: "" }
          : {
              id: crypto.randomUUID(),
              name: "",
              issuer: "",
              issuedYear: "",
              expiresYear: "",
              credentialUrl: "",
            };
    fields =
      section === "education"
        ? [
            {
              name: "school",
              label: "Trường / cơ sở đào tạo",
              required: true,
              span: "full",
            },
            presetField(
              "qualification",
              "Bằng cấp / trình độ",
              qualifications,
              true,
            ),
            presetField("field", "Chuyên ngành", studyFields),
            yearField("startYear", "Từ năm"),
            yearField("endYear", "Đến năm", true, true),
            {
              name: "description",
              label: "Thành tích / nội dung học tập",
              type: "textarea",
              hint: "Không bắt buộc",
              span: "full",
            },
          ]
        : section === "experience"
          ? [
              {
                name: "company",
                label: "Công ty / tổ chức",
                required: true,
                span: "full",
              },
              {
                ...presetField(
                  "position",
                  "Vị trí đảm nhiệm",
                  experiencePositions,
                  true,
                ),
                span: "full",
              },
              yearField("startYear", "Từ năm"),
              yearField("endYear", "Đến năm", true, true),
              {
                name: "description",
                label: "Trách nhiệm & thành tựu",
                type: "textarea",
                placeholder: "Mô tả ngắn công việc và kết quả nổi bật",
                span: "full",
              },
            ]
          : [
              {
                ...presetField("name", "Tên chứng chỉ", certificateNames, true),
                span: "full",
              },
              {
                ...presetField(
                  "issuer",
                  "Đơn vị cấp",
                  certificateIssuers,
                  true,
                ),
                span: "full",
              },
              yearField("issuedYear", "Năm cấp", false),
              yearField("expiresYear", "Năm hết hạn", false),
              {
                name: "credentialUrl",
                label: "Đường dẫn xác minh",
                placeholder: "https://",
                span: "full",
              },
            ];
  }
  return (
    <Modal
      title={t(
        remove
          ? "Xóa thông tin hồ sơ"
          : index < 0 && section !== "skills"
            ? "Thêm {0}"
            : "Cập nhật {0}",
        [t(label).toLocaleLowerCase()],
      )}
      description={employee.name}
      icon={<Icon size={21} />}
      size="wide"
      onClose={onClose}
    >
      {remove && <p>{t("Xóa mục này khỏi hồ sơ?")}</p>}
      <Form
        schema={schema}
        defaults={defaults}
        fields={fields}
        columns={section === "skills" ? 1 : 2}
        submitLabel={t(remove ? "Xóa" : "Lưu thay đổi")}
        submitTone={remove ? "danger" : undefined}
        onCancel={onClose}
        onSubmit={async (body) => {
          if (section === "skills") return persist(body.skills as string[]);
          const items: unknown[] = [...background[section as EntrySection]];
          if (remove) items.splice(index, 1);
          else if (index >= 0) items[index] = body;
          else items.push(body);
          await persist(items);
        }}
      />
    </Modal>
  );
}
