import { t, useLocale, intlLocale } from "../../i18n";
import { appendSentMessage } from "./chat-history";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronUp,
  MessageCircle,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import type {
  ChatMessage,
  ChatMessagePage,
  ChatPerson,
  ChatRoom,
} from "@hoosoo/shared";
import { useAuth } from "../../app/auth";
import { useApi } from "../../hooks/data";
import { api, ApiError } from "../../services/api-client";
import { refreshQueries } from "../../services/query-sync";
import { Avatar } from "../../components/ui/avatar";
import { Button, Input, ErrorBox, Loading } from "../../components/ui";
import { ChatDialog } from "./chat-dialog";
import {
  mergeMessages,
  roomName,
  useMessages,
  type MessageHistory,
} from "./chat-data";
import "../../style/pages/chat.css";
const day = (value: string) =>
  new Intl.DateTimeFormat(intlLocale(), {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
const time = (value: string) =>
  new Intl.DateTimeFormat(intlLocale(), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
export function ChatPage() {
  useLocale();
  const { me, live } = useAuth(),
    self = me!.actor.employeeId;
  const people = useApi<ChatPerson[]>("/chat/people"),
    rooms = useApi<ChatRoom[]>("/chat/rooms");
  const [params, setParams] = useSearchParams(),
    [search, setSearch] = useState(""),
    [dialog, setDialog] = useState<"new" | "edit" | null>(null);
  const id = params.get("room") ?? "",
    room = rooms.data?.find((r) => r.id === id);
  const select = (id: string) => setParams(id ? { room: id } : {});
  const directory = people.data ?? [],
    list = (rooms.data ?? []).filter((r) =>
      roomName(r, directory, self)
        .toLocaleLowerCase("vi")
        .includes(search.toLocaleLowerCase("vi")),
    );
  return (
    <div className="chat-page">
      <header className="chat-page-heading">
        <div>
          <span className="eyebrow">{t("KẾT NỐI ĐỒNG NGHIỆP")}</span>
          <h1>{t("Tin nhắn")}</h1>
        </div>
        <Button onClick={() => setDialog("new")} disabled={!people.data}>
          <Plus size={18} />
          {t("Cuộc trò chuyện mới")}
        </Button>
      </header>
      {(people.error || rooms.error) && (
        <ErrorBox
          error={people.error || rooms.error}
          retry={() => {
            void people.refetch();
            void rooms.refetch();
          }}
        />
      )}
      <div className={`chat-workspace ${id ? "chat-has-selection" : ""}`}>
        <aside className="chat-rail" aria-label={t("Cuộc trò chuyện")}>
          <div className="chat-rail-heading">
            <h2>
              {t("Hộp thư")} <span>{rooms.data?.length ?? 0}</span>
            </h2>
            <small className={live ? "chat-connected" : "chat-disconnected"}>
              {live ? t("Đang đồng bộ") : t("Đang kết nối lại")}
            </small>
          </div>
          <label className="chat-search">
            <Search size={17} />
            <Input
              aria-label={t("Tìm cuộc trò chuyện")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("Tìm cuộc trò chuyện…")}
            />
          </label>
          <div className="chat-room-list">
            {rooms.isPending ? (
              <Loading />
            ) : (
              list.map((r) => {
                const name = roomName(r, directory, self),
                  other = directory.find(
                    (p) => p.id === r.memberIds.find((x) => x !== self),
                  );
                return (
                  <button
                    type="button"
                    key={r.id}
                    className={`chat-room ${r.id === id ? "is-selected" : ""}`}
                    aria-current={r.id === id ? "true" : undefined}
                    onClick={() => select(r.id)}
                  >
                    {r.kind === "group" ? (
                      <span className="chat-group-avatar">
                        <UsersRound size={21} />
                      </span>
                    ) : (
                      <Avatar name={name} src={other?.avatarUrl} />
                    )}
                    <span className="chat-room-copy">
                      <strong>{name}</strong>
                      <small>
                        {r.lastMessage
                          ? `${r.lastMessage.senderId === self ? t("Bạn: ") : ""}${r.lastMessage.text}`
                          : t("Chưa có tin nhắn")}
                      </small>
                    </span>
                    {r.lastMessage && (
                      <time dateTime={r.lastMessage.sentAt}>
                        {new Date(r.lastMessage.sentAt).toLocaleDateString(
                          intlLocale(),
                          { day: "2-digit", month: "2-digit" },
                        )}
                      </time>
                    )}
                  </button>
                );
              })
            )}
            {!rooms.isPending && !list.length && (
              <div className="chat-rail-empty">
                <MessageCircle size={26} />
                <p>
                  {search
                    ? t("Không có kết quả phù hợp")
                    : t("Chưa có cuộc trò chuyện")}
                </p>
                <small>{t("Chọn đồng nghiệp để bắt đầu.")}</small>
              </div>
            )}
          </div>
          <div className="chat-privacy">
            <ShieldCheck size={16} />
            <span>{t("Riêng tư theo thành viên")}</span>
          </div>
        </aside>
        {room ? (
          <Conversation
            key={room.id}
            room={room}
            people={directory}
            self={self}
            onBack={() => select("")}
            onManage={() => setDialog("edit")}
          />
        ) : (
          <section className="chat-welcome">
            <span className="chat-welcome-icon">
              <MessageCircle size={34} />
            </span>
            <h2>
              {id
                ? t("Cuộc trò chuyện không khả dụng")
                : t("Bắt đầu một cuộc trò chuyện")}
            </h2>
            <p>
              {id
                ? t("Bạn không có quyền xem cuộc trò chuyện này.")
                : t("Chọn cuộc trò chuyện để bắt đầu.")}
            </p>
            <Button
              variant="secondary"
              onClick={() => setDialog("new")}
              disabled={!people.data}
            >
              <Plus size={17} />
              {t("Chọn đồng nghiệp")}
            </Button>
            <button className="chat-back-link" onClick={() => select("")}>
              {t("Quay lại hộp thư")}
            </button>
          </section>
        )}
      </div>
      {dialog && (
        <ChatDialog
          people={directory}
          self={self}
          room={dialog === "edit" ? room : undefined}
          onClose={() => setDialog(null)}
          onSaved={(id) => {
            setDialog(null);
            select(id);
          }}
        />
      )}
    </div>
  );
}
function Conversation({
  room,
  people,
  self,
  onBack,
  onManage,
}: {
  room: ChatRoom;
  people: ChatPerson[];
  self: string;
  onBack: () => void;
  onManage: () => void;
}) {
  useLocale();
  const messages = useMessages(room.id),
    client = useQueryClient(),
    scroll = useRef<HTMLDivElement>(null),
    bottom = useRef<HTMLDivElement>(null),
    nearBottom = useRef(true);
  const [draft, setDraft] = useState(""),
    [sending, setSending] = useState(false),
    [error, setError] = useState<Error | null>(null),
    [older, setOlder] = useState(false),
    [newBelow, setNewBelow] = useState(false);
  const retry = useRef<{ text: string; key: string } | null>(null);
  const items = messages.data?.items ?? [],
    last = items.at(-1)?.id;
  useEffect(() => {
    if (nearBottom.current)
      bottom.current?.scrollIntoView({ block: "nearest" });
    else if (last) setNewBelow(true);
  }, [last]);
  const denied =
    messages.error instanceof ApiError &&
    [401, 403, 404].includes(messages.error.status);
  const send = async () => {
    if (!draft.trim() || sending || messages.isPending) return;
    const text = draft.trim(),
      key =
        retry.current?.text === text ? retry.current.key : crypto.randomUUID();
    retry.current = { text, key };
    setSending(true);
    setError(null);
    try {
      const saved = await api<ChatMessage>(messages.path, {
        method: "POST",
        body: { text },
        key,
      });
      client.setQueryData<MessageHistory>(messages.key, (old) =>
        appendSentMessage(old, saved),
      );
      setDraft("");
      retry.current = null;
      nearBottom.current = true;
      void refreshQueries(client, ["chatRooms", "chatMessages"]);
    } catch (e) {
      setError(e as Error);
    } finally {
      setSending(false);
    }
  };
  const loadOlder = async () => {
    if (older) return;
    setOlder(true);
    setError(null);
    const before = items[0]?.sequence,
      height = scroll.current?.scrollHeight ?? 0;
    try {
      const result = await api<ChatMessagePage>(
        `${messages.path}?before=${before}`,
      );
      client.setQueryData<MessageHistory>(messages.key, (old) => ({
        items: mergeMessages(result.items, old?.items ?? []),
        hasOlder: result.hasMore,
      }));
      requestAnimationFrame(() => {
        if (scroll.current)
          scroll.current.scrollTop += scroll.current.scrollHeight - height;
      });
    } catch (e) {
      setError(e as Error);
    } finally {
      setOlder(false);
    }
  };
  const name = roomName(room, people, self),
    other = people.find(
      (p) => p.id === room.memberIds.find((id) => id !== self),
    );
  return (
    <section
      className="chat-conversation"
      aria-label={t("Trò chuyện {0}", [name])}
    >
      <header className="chat-conversation-heading">
        <button
          className="icon-button chat-mobile-back"
          onClick={onBack}
          aria-label={t("Quay lại hộp thư")}
        >
          <ArrowLeft size={19} />
        </button>
        {room.kind === "group" ? (
          <span className="chat-group-avatar">
            <UsersRound size={21} />
          </span>
        ) : (
          <Avatar name={name} src={other?.avatarUrl} />
        )}
        <div>
          <h2>{name}</h2>
          <p>
            {room.kind === "group"
              ? t("{0} thành viên · {1}", [
                  room.memberIds.length,
                  room.ownerId === self ? "Bạn là chủ nhóm" : "Nhóm riêng tư",
                ])
              : t("Cuộc trò chuyện riêng tư")}
          </p>
        </div>
        {room.kind === "group" && room.ownerId === self && (
          <Button variant="ghost" onClick={onManage}>
            <Settings2 size={17} />
            <span>{t("Quản lý nhóm")}</span>
          </Button>
        )}
      </header>
      {room.kind === "group" && (
        <div className="chat-members-line">
          <UsersRound size={14} />
          <span>
            {room.memberIds
              .map(
                (id) =>
                  people.find((p) => p.id === id)?.name ?? t("Thành viên"),
              )
              .join(", ")}
          </span>
        </div>
      )}
      <div
        className="chat-messages"
        ref={scroll}
        onScroll={() => {
          const e = scroll.current!;
          nearBottom.current =
            e.scrollHeight - e.scrollTop - e.clientHeight < 90;
          if (nearBottom.current) setNewBelow(false);
        }}
      >
        {messages.error && (
          <ErrorBox
            error={messages.error}
            retry={() => void messages.refetch()}
          />
        )}
        {messages.isPending ? (
          <Loading />
        ) : (
          !denied && (
            <>
              {messages.data?.hasOlder && (
                <div className="chat-older">
                  <Button
                    variant="ghost"
                    busy={older}
                    onClick={() => void loadOlder()}
                  >
                    <ChevronUp size={16} />
                    {t("Xem tin nhắn trước")}
                  </Button>
                </div>
              )}
              {!items.length && (
                <div className="chat-empty-thread">
                  <ShieldCheck size={25} />
                  <strong>
                    {t("Không gian trao đổi của")}{" "}
                    {room.kind === "group" ? t("nhóm") : t("hai bạn")}
                  </strong>
                </div>
              )}
              {items.map((m, index) => {
                const sender = people.find((p) => p.id === m.senderId),
                  mine = m.senderId === self,
                  showDate =
                    index === 0 ||
                    day(m.sentAt) !== day(items[index - 1].sentAt);
                return (
                  <div key={m.id}>
                    {showDate && (
                      <div className="chat-day">{day(m.sentAt)}</div>
                    )}
                    <article
                      className={`chat-message ${mine ? "is-mine" : ""}`}
                    >
                      {!mine && (
                        <Avatar
                          name={sender?.name ?? t("Đồng nghiệp")}
                          src={sender?.avatarUrl}
                        />
                      )}
                      <div className="chat-message-content">
                        {!mine && (
                          <strong>{sender?.name ?? t("Đồng nghiệp")}</strong>
                        )}
                        <p>{m.text}</p>
                        <time dateTime={m.sentAt}>
                          {time(m.sentAt)}
                          {mine && t(" · Đã gửi")}
                        </time>
                      </div>
                    </article>
                  </div>
                );
              })}
            </>
          )
        )}
        <div ref={bottom} />
      </div>
      {newBelow && (
        <button
          className="chat-new-below"
          onClick={() => {
            bottom.current?.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            });
            setNewBelow(false);
          }}
        >
          {t("Có tin nhắn mới ↓")}
        </button>
      )}
      <form
        className="chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        {error && <ErrorBox error={error} />}
        <div>
          <textarea
            aria-label={t("Nội dung tin nhắn")}
            placeholder={t("Viết tin nhắn…")}
            maxLength={4000}
            value={draft}
            disabled={denied || sending || messages.isPending}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <Button
            aria-label={t("Gửi tin nhắn")}
            type="submit"
            busy={sending}
            disabled={!draft.trim() || denied || messages.isPending}
          >
            <Send size={19} />
          </Button>
        </div>
        <footer>
          <span>{t("Enter để gửi · Shift + Enter để xuống dòng")}</span>
          <span>{draft.length}/4.000</span>
        </footer>
      </form>
    </section>
  );
}
