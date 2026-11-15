import type { ChatSystemEvent } from "@hoosoo/shared";
import { t } from "../../i18n";

export function chatEventText(event: ChatSystemEvent) {
  return t(
    event.type === "member_left" ? "{0} đã rời nhóm." : "{0} đã giải tán nhóm.",
    [event.name],
  );
}
