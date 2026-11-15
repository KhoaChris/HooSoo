import type { ChatMessage, ChatPerson } from "@hoosoo/shared";
import { Avatar } from "../../components/ui/avatar";
import { intlLocale, t, useLocale } from "../../i18n";
import { groupMessages } from "./chat-history";
import { chatEventText } from "./chat-labels";
import { LogOut, UsersRound } from "lucide-react";

export function ChatMessageList({
  items,
  people,
  self,
}: {
  items: ChatMessage[];
  people: ChatPerson[];
  self: string;
}) {
  useLocale();
  const groups = groupMessages(items);
  const directory = new Map(people.map((person) => [person.id, person]));
  const day = new Intl.DateTimeFormat(intlLocale(), {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const time = new Intl.DateTimeFormat(intlLocale(), {
    hour: "2-digit",
    minute: "2-digit",
  });

  return groups.map((group, index) => {
    const first = group[0];
    const last = group[group.length - 1];
    const sender = directory.get(first.senderId);
    const mine = first.senderId === self;
    const name = mine ? t("Bạn") : (sender?.name ?? t("Đồng nghiệp"));
    const dateLabel = day.format(new Date(first.sentAt));
    const showDate =
      index === 0 ||
      dateLabel !== day.format(new Date(groups[index - 1][0].sentAt));

    return (
      <div key={first.id}>
        {showDate && <div className="chat-day">{dateLabel}</div>}
        {first.event ? (
          <div
            className="chat-system-event"
            title={time.format(new Date(first.sentAt))}
          >
            {first.event.type === "member_left" ? (
              <LogOut size={14} aria-hidden="true" />
            ) : (
              <UsersRound size={14} aria-hidden="true" />
            )}
            <span>{chatEventText(first.event)}</span>
          </div>
        ) : (
          <article
            className={`chat-message ${mine ? "is-mine" : ""}`}
            aria-label={name}
          >
            {!mine && (
              <div className="chat-message-avatar">
                <Avatar
                  name={name}
                  src={sender?.avatarUrl}
                  employeeId={sender?.id}
                />
              </div>
            )}
            <div className="chat-message-content">
              {!mine && <strong>{name}</strong>}
              <div className="chat-message-bubbles">
                {group.map((message, messageIndex) => {
                  const sentTime = time.format(new Date(message.sentAt));
                  return (
                    <p
                      className="chat-bubble"
                      key={message.id}
                      title={`${dateLabel} · ${sentTime}`}
                    >
                      {message.text}
                      {messageIndex < group.length - 1 && (
                        <time className="sr-only" dateTime={message.sentAt}>
                          {" "}
                          {sentTime}
                        </time>
                      )}
                    </p>
                  );
                })}
              </div>
              <time className="chat-message-time" dateTime={last.sentAt}>
                {time.format(new Date(last.sentAt))}
                {mine && t(" · Đã gửi")}
              </time>
            </div>
          </article>
        )}
      </div>
    );
  });
}
