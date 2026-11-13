import { z } from "zod";
import { Input, Select } from "../../components/ui";
import type { CustomFieldProps } from "../../components/ui/form";
import { t, useLocale } from "../../i18n";

const newPlace = "__new_place__";
const providers = [
  { value: "meet", label: "Google Meet", hosts: ["meet.google.com"] },
  {
    value: "teams",
    label: "Microsoft Teams",
    hosts: ["teams.microsoft.com", "teams.live.com", "teams.cloud.microsoft"],
  },
  { value: "zoom", label: "Zoom", hosts: ["zoom.us", "zoom.com"] },
  { value: "other", label: "Nền tảng khác", hosts: [] },
] as const;

type LocationDraft = {
  mode: "onsite" | "online";
  place: string;
  address: string;
  provider: (typeof providers)[number]["value"];
  link: string;
};

function meetingUrl(value: string): URL | null {
  try {
    const url = new URL(value.includes(":") ? value : `https://${value}`);
    return ["https:", "http:"].includes(url.protocol) &&
      url.hostname.includes(".") &&
      !url.username &&
      !url.password
      ? url
      : null;
  } catch {
    return null;
  }
}

function matchesProvider(host: string, hosts: readonly string[]) {
  return hosts.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
}

function savedMeetingUrl(value: string) {
  return /^(?:https?:\/\/|[a-z0-9.-]+\.[a-z]{2,}(?:[/?#]|$))/i.test(value)
    ? meetingUrl(value)
    : null;
}

export function interviewLocationDefaults(location = ""): LocationDraft {
  const saved = location.trim();
  const url = savedMeetingUrl(saved);
  return {
    mode: url ? "online" : "onsite",
    place: saved && !url ? saved : newPlace,
    address: url ? "" : saved,
    provider:
      providers.find((p) => url && matchesProvider(url.hostname, p.hosts))
        ?.value ?? (url ? "other" : "meet"),
    link: url ? saved : "",
  };
}

// The guided fields stay in the browser; the API still receives one location string.
export const interviewLocationSchema = z
  .custom<LocationDraft>()
  .superRefine((value, ctx) => {
    let message = "";
    if (value.mode === "onsite") {
      if (value.address.trim().length < 3)
        message = "Chọn hoặc nhập địa điểm phỏng vấn.";
      else if (value.address.trim().length > 300)
        message = "Địa điểm tối đa 300 ký tự.";
    } else {
      const url = meetingUrl(value.link.trim());
      const provider = providers.find((p) => p.value === value.provider);
      if (!url) message = "Nhập liên kết cuộc họp hợp lệ (https://…).";
      else if (url.href.length > 300) message = "Liên kết tối đa 300 ký tự.";
      else if (
        provider &&
        provider.value !== "other" &&
        !matchesProvider(url.hostname, provider.hosts)
      ) {
        message = "Liên kết không thuộc nền tảng đã chọn.";
      }
    }
    if (message) ctx.addIssue({ code: "custom", message });
  })
  .transform((value) =>
    value.mode === "onsite"
      ? value.address.trim()
      : meetingUrl(value.link.trim())!.href,
  );

export function InterviewLocation({
  value,
  onChange,
  onBlur,
  ref,
  id,
  labelId,
  disabled,
  invalid,
  describedBy,
  locations,
}: CustomFieldProps & { locations: string[] }) {
  useLocale();
  const draft = value as LocationDraft;
  const set = (patch: Partial<LocationDraft>) =>
    onChange({ ...draft, ...patch });
  const places = [
    ...new Set([...locations, draft.place === newPlace ? "" : draft.place]),
  ]
    .filter((place) => place.trim() && !savedMeetingUrl(place))
    .sort((a, b) => a.localeCompare(b, "vi"));
  return (
    <div className="interview-location" role="group" aria-labelledby={labelId}>
      <div className="field">
        <label htmlFor={`${id}-mode`}>{t("Hình thức")}</label>
        <Select
          id={`${id}-mode`}
          ref={ref}
          value={draft.mode}
          disabled={disabled}
          onBlur={onBlur}
          onValueChange={(mode) => set({ mode: mode as LocationDraft["mode"] })}
          options={[
            { value: "onsite", label: t("Trực tiếp") },
            { value: "online", label: t("Trực tuyến") },
          ]}
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-choice`}>
          {t(draft.mode === "online" ? "Nền tảng" : "Địa điểm")}
        </label>
        <Select
          id={`${id}-choice`}
          disabled={disabled}
          onBlur={onBlur}
          value={draft.mode === "online" ? draft.provider : draft.place}
          onValueChange={(choice) =>
            draft.mode === "online"
              ? set({ provider: choice as LocationDraft["provider"] })
              : set({
                  place: choice,
                  address: choice === newPlace ? "" : choice,
                })
          }
          options={
            draft.mode === "online"
              ? providers.map((p) => ({ value: p.value, label: t(p.label) }))
              : [
                  ...places.map((place) => ({ value: place, label: place })),
                  { value: newPlace, label: t("Nhập địa điểm mới") },
                ]
          }
        />
      </div>
      {(draft.mode === "online" || draft.place === newPlace) && (
        <div className="field interview-location-detail">
          <label htmlFor={`${id}-detail`}>
            {t(
              draft.mode === "online"
                ? "Liên kết cuộc họp"
                : "Địa chỉ / phòng họp",
            )}{" "}
            <span className="field-required">*</span>
          </label>
          <Input
            id={`${id}-detail`}
            type={draft.mode === "online" ? "url" : "text"}
            value={draft.mode === "online" ? draft.link : draft.address}
            placeholder={t(
              draft.mode === "online"
                ? "Dán liên kết cuộc họp"
                : "Tên phòng, tầng hoặc địa chỉ cụ thể",
            )}
            onChange={(event) =>
              set(
                draft.mode === "online"
                  ? { link: event.target.value }
                  : { address: event.target.value },
              )
            }
            onBlur={onBlur}
            disabled={disabled}
            maxLength={300}
            aria-required="true"
            aria-invalid={invalid}
            aria-describedby={describedBy}
            autoComplete="off"
          />
        </div>
      )}
    </div>
  );
}
