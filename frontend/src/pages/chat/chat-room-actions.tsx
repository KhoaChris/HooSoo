import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import * as Popover from "@radix-ui/react-popover";
import {
  Archive,
  ArchiveRestore,
  LogOut,
  MoreHorizontal,
  Trash2,
  UsersRound,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { ChatLifecycleInput, ChatRoomView } from "@hoosoo/shared";
import { t, useLocale } from "../../i18n";
import { useAction } from "../../hooks/data";
import { ApiError } from "../../services/api-client";
import { refreshQueries } from "../../services/query-sync";
import { Button, ErrorBox, Modal } from "../../components/ui";
import { useModalForm } from "../../components/ui/modal";

type Action = ChatLifecycleInput["action"];
const labels: Record<Action, string> = {
  archive: "Lưu trữ",
  restore: "Bỏ lưu trữ",
  leave: "Rời nhóm",
  dissolve: "Giải tán nhóm",
  hide: "Xóa khỏi hộp thư",
};
const descriptions: Partial<Record<Action, string>> = {
  leave: "Bạn sẽ không còn xem hoặc gửi tin nhắn trong nhóm.",
  dissolve: "Nhóm sẽ ngừng nhận tin nhắn. Mọi thành viên vẫn xem được lịch sử.",
  hide: "Nhóm chỉ biến mất khỏi hộp thư của bạn.",
};
export function ChatRoomActions({
  room,
  self,
  onFinished,
  removeOnly = false,
}: {
  room: ChatRoomView;
  self: string;
  onFinished: (action: Action) => void;
  removeOnly?: boolean;
}) {
  useLocale();
  const [open, setOpen] = useState(false),
    [confirm, setConfirm] = useState<Action | null>(null);
  const action = useAction(),
    client = useQueryClient();
  const run = async (choice: Action) => {
    if (action.isPending) return;
    try {
      await action.mutateAsync({
        path: `/chat/rooms/${room.id}/lifecycle`,
        body: {
          action: choice,
          version: room.version,
          preferenceVersion: room.viewer?.version ?? 0,
        },
      });
      setConfirm(null);
      onFinished(choice);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409)
        await refreshQueries(client, ["chatRooms"]);
    }
  };
  const choose = (choice: Action) => {
    setOpen(false);
    action.reset();
    if (choice === "archive" || choice === "restore") void run(choice);
    else setConfirm(choice);
  };
  return (
    <>
      {removeOnly ? (
        <Button
          type="button"
          variant="ghost"
          tone="danger"
          onClick={() => choose("hide")}
        >
          <Trash2 size={16} />
          {t(labels.hide)}
        </Button>
      ) : (
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              className="icon-button chat-room-options"
              aria-label={t("Tùy chọn nhóm")}
              title={t("Tùy chọn nhóm")}
              disabled={action.isPending}
            >
              <MoreHorizontal size={20} />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="chat-room-menu"
              align="end"
              sideOffset={8}
              collisionPadding={12}
              aria-label={t("Tùy chọn nhóm")}
            >
              <button
                type="button"
                onClick={() =>
                  choose(room.viewer?.archived ? "restore" : "archive")
                }
              >
                {room.viewer?.archived ? (
                  <ArchiveRestore size={17} />
                ) : (
                  <Archive size={17} />
                )}
                {t(room.viewer?.archived ? labels.restore : labels.archive)}
              </button>
              {room.dissolved ? (
                <button
                  type="button"
                  data-tone="danger"
                  onClick={() => choose("hide")}
                >
                  <Trash2 size={17} />
                  {t(labels.hide)}
                </button>
              ) : room.ownerId === self ? (
                <button
                  type="button"
                  data-tone="danger"
                  onClick={() => choose("dissolve")}
                >
                  <UsersRound size={17} />
                  {t(labels.dissolve)}
                </button>
              ) : (
                <button
                  type="button"
                  data-tone="danger"
                  onClick={() => choose("leave")}
                >
                  <LogOut size={17} />
                  {t(labels.leave)}
                </button>
              )}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
      {confirm &&
        createPortal(
          <Modal
            title={t(labels[confirm])}
            description={room.title}
            icon={
              confirm === "leave" ? <LogOut size={20} /> : <Trash2 size={20} />
            }
            onClose={() => setConfirm(null)}
            className="chat-lifecycle-dialog"
          >
            <LifecycleConfirmation
              busy={action.isPending}
              error={action.error}
              label={t(labels[confirm])}
              description={t(descriptions[confirm])}
              onConfirm={() => void run(confirm)}
            />
          </Modal>,
          document.body,
        )}
    </>
  );
}
function LifecycleConfirmation({
  busy,
  error,
  label,
  description,
  onConfirm,
}: {
  busy: boolean;
  error: Error | null;
  label: string;
  description: string;
  onConfirm: () => void;
}) {
  const modal = useModalForm();
  const setStatus = modal?.setFormStatus;
  useEffect(() => {
    setStatus?.({ busy, dirty: false });
  }, [busy, setStatus]);
  return (
    <div className="chat-lifecycle-confirm">
      <p>{description}</p>
      <ErrorBox error={error} />
      <div className="form-actions">
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={modal?.requestClose}
        >
          {t("Hủy")}
        </Button>
        <Button type="button" tone="danger" busy={busy} onClick={onConfirm}>
          {label}
        </Button>
      </div>
    </div>
  );
}
