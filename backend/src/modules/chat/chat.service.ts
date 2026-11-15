import { createHash } from "node:crypto";
import {
  chatViewer,
  type Actor,
  type ChatRoom,
  type ChatRoomView,
  type ChatLifecycleInput,
  type ChatSystemEvent,
  type State,
} from "@hoosoo/shared";
import { assert, notFound } from "../../utils/errors";
export const chatId = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const messageId = (roomId: string, sequence: number) =>
  `${roomId}_${String(sequence).padStart(12, "0")}`;
export function roomFor(s: State, a: Actor, id: string): ChatRoom {
  const room = s.chatRooms[id];
  if (!room?.memberIds.includes(a.employeeId)) notFound();
  return room;
}
export function roomView(room: ChatRoom, a: Actor): ChatRoomView {
  const { memberState, ...publicRoom } = room;
  void memberState;
  return { ...publicRoom, viewer: chatViewer(room, a.employeeId) };
}
function assertOpen(room: ChatRoom) {
  assert(
    !room.dissolved,
    409,
    "GROUP_DISSOLVED",
    "Nhóm đã giải tán. Không thể gửi tin nhắn hoặc thay đổi thành viên.",
  );
}
export function changeLifecycle(
  s: State,
  a: Actor,
  id: string,
  input: ChatLifecycleInput,
) {
  const room = roomFor(s, a, id);
  assert(
    room.kind === "group",
    400,
    "GROUP_REQUIRED",
    "Thao tác này chỉ áp dụng cho nhóm chat.",
  );
  assert(
    room.version === input.version,
    409,
    "VERSION_CONFLICT",
    "Nhóm vừa thay đổi. Vui lòng thử lại.",
  );
  if (["archive", "restore", "hide"].includes(input.action)) {
    const previous = room.memberState?.[a.employeeId];
    assert(
      (previous?.version ?? 0) === input.preferenceVersion,
      409,
      "VERSION_CONFLICT",
      "Hộp thư vừa thay đổi. Vui lòng thử lại.",
    );
    if (input.action === "hide")
      assert(
        room.dissolved,
        409,
        "GROUP_STILL_ACTIVE",
        "Chỉ có thể xóa khỏi hộp thư sau khi nhóm đã giải tán.",
      );
    const next = { ...previous, version: (previous?.version ?? 0) + 1 };
    if (input.action === "archive") next.archivedThrough = room.sequence;
    else delete next.archivedThrough;
    if (input.action === "hide") next.hidden = true;
    room.memberState = { ...room.memberState, [a.employeeId]: next };
    return roomView(room, a);
  }
  assertOpen(room);
  if (input.action === "leave") {
    assert(
      room.ownerId !== a.employeeId,
      409,
      "OWNER_CANNOT_LEAVE",
      "Chuyển quyền chủ nhóm trước khi rời nhóm.",
    );
    appendSystemMessage(s, a, room, "member_left");
    room.memberIds = room.memberIds.filter((member) => member !== a.employeeId);
    if (room.memberState) delete room.memberState[a.employeeId];
    room.version++;
    return { id: room.id, left: true };
  }
  assert(
    room.ownerId === a.employeeId,
    403,
    "GROUP_OWNER_REQUIRED",
    "Chỉ chủ nhóm được giải tán nhóm.",
  );
  const message = appendSystemMessage(s, a, room, "group_dissolved");
  room.dissolved = {
    byId: a.employeeId,
    byName: s.employees[a.employeeId].name,
    at: message.sentAt,
  };
  room.version++;
  return roomView(room, a);
}
function appendSystemMessage(
  s: State,
  a: Actor,
  room: ChatRoom,
  type: ChatSystemEvent["type"],
) {
  const name = s.employees[a.employeeId].name;
  return appendMessage(
    s,
    room,
    a.employeeId,
    type === "member_left"
      ? `${name} đã rời nhóm.`
      : `${name} đã giải tán nhóm.`,
    { type, employeeId: a.employeeId, name },
  );
}
export function validateMembers(s: State, ids: string[]) {
  assert(
    ids.length >= 2 && ids.length <= 30 && new Set(ids).size === ids.length,
    400,
    "INVALID_MEMBERS",
    "Chọn từ 2 đến 30 thành viên khác nhau.",
  );
  for (const id of ids) {
    const e = s.employees[id],
      m = e?.uid ? s.memberships[e.uid] : undefined;
    assert(
      e && e.status !== "terminated" && m?.active && m.employeeId === id,
      400,
      "MEMBER_UNAVAILABLE",
      "Một thành viên không còn tài khoản hoạt động. Vui lòng chọn lại.",
    );
  }
}
export function createRoom(
  s: State,
  a: Actor,
  id: string,
  input: { kind: "direct" | "group"; title: string; memberIds: string[] },
) {
  const members = [...new Set([a.employeeId, ...input.memberIds])].sort();
  validateMembers(s, members);
  assert(
    input.kind !== "direct" || members.length === 2,
    400,
    "DIRECT_MEMBERS",
    "Tin nhắn riêng chỉ có hai người.",
  );
  assert(
    input.kind !== "group" || input.title.length > 0,
    400,
    "GROUP_TITLE_REQUIRED",
    "Vui lòng nhập tên nhóm.",
  );
  if (s.chatRooms[id]) return roomFor(s, a, id);
  const room: ChatRoom = {
    id,
    kind: input.kind,
    title: input.kind === "group" ? input.title : "",
    memberIds: members,
    ownerId: a.employeeId,
    version: 1,
    sequence: 0,
    lastMessage: null,
  };
  s.chatRooms[id] = room;
  return room;
}
export function updateGroup(
  s: State,
  a: Actor,
  id: string,
  input: {
    title: string;
    memberIds: string[];
    ownerId: string;
    version: number;
  },
) {
  const room = roomFor(s, a, id);
  assertOpen(room);
  assert(
    room.kind === "group" && room.ownerId === a.employeeId,
    403,
    "GROUP_OWNER_REQUIRED",
    "Chỉ chủ nhóm được quản lý nhóm.",
  );
  assert(
    room.version === input.version,
    409,
    "VERSION_CONFLICT",
    "Nhóm vừa thay đổi. Hãy đóng và mở lại để cập nhật.",
  );
  validateMembers(s, input.memberIds);
  assert(
    input.memberIds.includes(input.ownerId),
    400,
    "OWNER_REQUIRED",
    "Chủ nhóm phải nằm trong danh sách thành viên.",
  );
  Object.assign(room, input, {
    memberIds: [...input.memberIds].sort(),
    version: room.version + 1,
  });
  return room;
}
export function sendMessage(s: State, a: Actor, id: string, text: string) {
  const room = roomFor(s, a, id);
  assertOpen(room);
  return appendMessage(s, room, a.employeeId, text);
}
function appendMessage(
  s: State,
  room: ChatRoom,
  senderId: string,
  text: string,
  event?: ChatSystemEvent,
) {
  const id = room.id;
  const sequence = room.sequence + 1,
    sentAt = new Date().toISOString();
  assert(
    sequence < 1e12,
    409,
    "CHAT_LIMIT",
    "Cuộc trò chuyện đã đạt giới hạn lưu trữ.",
  );
  const message = {
    id: messageId(id, sequence),
    roomId: id,
    sequence,
    senderId,
    text,
    sentAt,
    ...(event ? { event } : {}),
  };
  s.chatMessages[message.id] = message;
  room.sequence = sequence;
  room.lastMessage = {
    text: text.slice(0, 160),
    senderId,
    sentAt,
    ...(event ? { event } : {}),
  };
  return message;
}
