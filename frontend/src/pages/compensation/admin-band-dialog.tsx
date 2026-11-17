import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import {
  adminBandSchema,
  type AdminBandWorkspace,
  type SalaryPackage,
} from "@hoosoo/shared";
import { useApi, useAction } from "../../hooks/data";
import { ErrorBox, Form, Loading, Modal } from "../../components/ui";
import { t, useLocale, intlLocale } from "../../i18n";
import { SalaryPackageEditor } from "./reward-fields";
import { emptySalaryPackage, moneyLabel } from "./compensation-model";

export function AdminBandDialog({ onClose }: { onClose: () => void }) {
  useLocale();
  const q = useApi<AdminBandWorkspace>("/compensation/admin-band");
  const save = useAction();
  const [initial, setInitial] = useState<AdminBandWorkspace | null>(null);
  useEffect(() => {
    // Wait for an invalidated cached result before initializing the form.
    // Later background updates must not replace edits already in progress.
    if (!initial && q.data && !q.isFetching) setInitial(q.data);
  }, [initial, q.data, q.isFetching]);
  return (
    <Modal
      title={t("Band lương Admin")}
      icon={<ShieldCheck size={22} />}
      size="wide"
      className="compensation-dialog"
      onClose={onClose}
    >
      {!initial && q.error ? (
        <ErrorBox error={q.error} retry={() => void q.refetch()} />
      ) : !initial ? (
        <Loading />
      ) : (
        initial && (
          <>
            <p className="band-scope">
              {t("Áp dụng chung cho tất cả Admin. Chỉ Admin được cấu hình.")}
            </p>
            {!initial.band && initial.existingPackage && (
              <p className="band-prefill">
                {t("Đã điền mức lương hiện tại của bạn.")}
              </p>
            )}
            <Form
              key={initial.band?.version ?? 0}
              schema={adminBandSchema}
              defaults={{
                version: initial.band?.version ?? 0,
                reason: "",
                package: structuredClone(
                  initial.band?.package ??
                    initial.existingPackage ??
                    emptySalaryPackage(),
                ),
              }}
              fields={[
                {
                  name: "package",
                  label: t("Chế độ đãi ngộ"),
                  required: true,
                  render: (p) => (
                    <SalaryPackageEditor
                      allowProbation={false}
                      id={p.id}
                      labelledBy={p.labelId}
                      describedBy={p.describedBy}
                      value={p.value as SalaryPackage}
                      onChange={p.onChange}
                      disabled={p.disabled}
                      invalid={p.invalid}
                    />
                  ),
                },
                {
                  name: "reason",
                  label: t("Lý do điều chỉnh"),
                  type: "textarea",
                  required: true,
                },
              ]}
              submitLabel={t("Áp dụng band cho Admin")}
              onCancel={onClose}
              onSubmit={async (body) => {
                await save.mutateAsync({
                  path: "/compensation/admin-band",
                  body,
                });
                onClose();
              }}
            />
            {!!initial.history.length && (
              <details className="band-history">
                <summary>{t("Lịch sử band lương")}</summary>
                <ol>
                  {initial.history.map((band) => (
                    <li key={band.id}>
                      <strong>{moneyLabel(band.package.baseSalary)}</strong>
                      <span>
                        {band.changedByName} ·{" "}
                        {band.createdAt &&
                          new Intl.DateTimeFormat(intlLocale(), {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(new Date(band.createdAt))}
                      </span>
                      <p>{band.reason}</p>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </>
        )
      )}
    </Modal>
  );
}
