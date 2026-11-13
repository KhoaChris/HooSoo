import { StableText } from "../../i18n/stable-text";
import { t, useLocale } from "../../i18n";
import { useEffect, useState } from "react";
import { MessageSquarePlus, UsersRound, Search } from "lucide-react";
import type { ChatPerson, ChatRoom } from "@hoosoo/shared";
import {
  Button,
  Checkbox,
  Input,
  Modal,
  Select,
  ErrorBox,
} from "../../components/ui";
import { Avatar } from "../../components/ui/avatar";
import { useModalForm } from "../../components/ui/modal";
import { useAction } from "../../hooks/data";
export function ChatDialog(props: {
  people: ChatPerson[];
  self: string;
  room?: ChatRoom;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  useLocale();
  return (
    <Modal
      title={props.room ? t("Quản lý nhóm") : t("Cuộc trò chuyện mới")}
      icon={<MessageSquarePlus size={21} />}
      onClose={props.onClose}
    >
      <ChatForm {...props} />
    </Modal>
  );
}
function ChatForm({
  people,
  self,
  room,
  onSaved,
}: Parameters<typeof ChatDialog>[0]) {
  useLocale();
  const [kind, setKind] = useState<"direct" | "group">(room?.kind ?? "direct"),
    [title, setTitle] = useState(room?.title ?? ""),
    [search, setSearch] = useState("");
  const [version] = useState(room?.version);
  const [members, setMembers] = useState<string[]>(room?.memberIds ?? []),
    [owner, setOwner] = useState(room?.ownerId ?? self);
  const action = useAction(),
    modal = useModalForm();
  const setFormStatus = modal?.setFormStatus;
  useEffect(() => {
    setFormStatus?.({
      dirty:
        title !== (room?.title ?? "") ||
        JSON.stringify(members) !== JSON.stringify(room?.memberIds ?? []) ||
        owner !== (room?.ownerId ?? self),
      busy: action.isPending,
    });
  }, [setFormStatus, title, members, owner, room, self, action.isPending]);
  const toggle = (id: string) =>
    setMembers((current) =>
      kind === "direct"
        ? [id]
        : current.includes(id)
          ? current.filter((x) => x !== id)
          : [...current, id],
    );
  const list = people.filter(
    (p) =>
      (room || p.id !== self) &&
      p.name.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi")),
  );
  return (
    <form
      className="chat-dialog-form"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const saved = (await action.mutateAsync({
            path: room ? `/chat/rooms/${room.id}` : "/chat/rooms",
            method: room ? "PATCH" : "POST",
            body: room
              ? {
                  title,
                  memberIds: members,
                  ownerId: owner,
                  version,
                }
              : { kind, title, memberIds: members },
          })) as ChatRoom;
          onSaved(saved.id);
        } catch {
          /* Error remains next to the form. */
        }
      }}
    >
      {!room && (
        <div className="chat-kind" aria-label={t("Loại cuộc trò chuyện")}>
          {(["direct", "group"] as const).map((k) => (
            <button
              type="button"
              key={k}
              aria-pressed={kind === k}
              onClick={() => {
                setKind(k);
                setMembers([]);
              }}
            >
              {k === "direct" ? (
                <MessageSquarePlus size={18} />
              ) : (
                <UsersRound size={18} />
              )}
              <span>{k === "direct" ? t("Nhắn riêng") : t("Tạo nhóm")}</span>
            </button>
          ))}
        </div>
      )}
      {kind === "group" && (
        <label className="chat-field">
          <StableText>{t("Tên nhóm")}</StableText>
          <Input
            required
            maxLength={80}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("Ví dụ: Đội sản phẩm")}
          />
        </label>
      )}
      <div className="chat-selection-heading">
        <strong>
          <StableText>
            {kind === "group" ? t("Thành viên") : t("Chọn đồng nghiệp")}
          </StableText>
        </strong>
        <span>
          {members.length} {t("đã chọn")}
        </span>
      </div>
      <label className="chat-search">
        <Search size={17} />
        <Input
          aria-label={t("Tìm đồng nghiệp")}
          placeholder={t("Tìm theo tên…")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div className="chat-people-picker">
        {list.map((p) => (
          <label className="chat-person-option" key={p.id}>
            <Avatar name={p.name} src={p.avatarUrl} />
            <span className="chat-person-name">
              {p.name}
              {p.id === self && (
                <small>
                  <StableText>{t("Bạn")}</StableText>
                </small>
              )}
            </span>
            <Checkbox
              aria-label={t("Chọn {0}", [p.name])}
              checked={members.includes(p.id)}
              onChange={() => toggle(p.id)}
              disabled={
                kind === "group" &&
                members.length >= (room ? 30 : 29) &&
                !members.includes(p.id)
              }
            />
          </label>
        ))}
        {!list.length && (
          <p className="chat-muted">
            <StableText>{t("Không tìm thấy đồng nghiệp phù hợp.")}</StableText>
          </p>
        )}
      </div>
      {room && (
        <label className="chat-field">
          <StableText>{t("Chủ nhóm")}</StableText>
          <Select
            aria-label={t("Chủ nhóm")}
            value={owner}
            onValueChange={setOwner}
            options={people
              .filter((p) => members.includes(p.id))
              .map((p) => ({ value: p.id, label: p.name }))}
          />
        </label>
      )}
      {kind === "group" && (
        <p className="chat-access-note">
          <StableText>{t("Thành viên mới xem được lịch sử nhóm.")}</StableText>
        </p>
      )}
      {action.error && <ErrorBox error={action.error} />}
      <div className="chat-dialog-footer">
        <Button
          type="button"
          variant="secondary"
          onClick={modal?.requestClose}
          disabled={action.isPending}
        >
          {t("Hủy")}
        </Button>
        <Button
          type="submit"
          busy={action.isPending}
          disabled={!members.length || (kind === "group" && !title.trim())}
        >
          {room
            ? t("Lưu thay đổi")
            : kind === "group"
              ? t("Tạo nhóm")
              : t("Bắt đầu trò chuyện")}
        </Button>
      </div>
    </form>
  );
}
