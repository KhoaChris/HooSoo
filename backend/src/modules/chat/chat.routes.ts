import { Router } from "express";
import { z } from "zod";
import {
  chatCreateSchema,
  chatGroupSchema,
  chatMessageSchema,
} from "@hoosoo/shared";
import { context, param } from "../../routes/helpers";
import { readState, mergeState } from "../../database/store";
import { validate } from "../../middleware/validate";
import { chatCommand, readMessages } from "./chat.repository";
import {
  chatId,
  createRoom,
  roomFor,
  sendMessage,
  updateGroup,
} from "./chat.service";
export const chatRoutes = Router();
chatRoutes.get("/chat/people", async (_req, res) => {
  await context(res, [], true);
  const s = await readState(["employees"]);
  // Only the shared work directory is exposed, never personal contact details.
  res.json(
    Object.values(s.employees)
      .filter((e) => e.uid && e.status !== "terminated")
      .map((e) => ({
        id: e.id,
        name: e.name,
        avatarUrl: e.avatarUrl ?? null,
        departmentId: e.departmentId,
      })),
  );
});
chatRoutes.get("/chat/rooms", async (_req, res) => {
  const { a } = await context(res, [], true);
  const s = await readState(["chatRooms"], {
    chatRooms: {
      field: "memberIds",
      op: "array-contains-any",
      value: [a.employeeId],
    },
  });
  res.json(
    Object.values(s.chatRooms).sort((a, b) =>
      (b.lastMessage?.sentAt || b.createdAt || "").localeCompare(
        a.lastMessage?.sentAt || a.createdAt || "",
      ),
    ),
  );
});
chatRoutes.get("/chat/rooms/:roomId/messages", async (req, res) => {
  const id = param(req, "roomId");
  const q = validate(
    z
      .object({
        after: z.coerce.number().int().min(0).max(999999999999).optional(),
        before: z.coerce.number().int().min(1).max(999999999999).optional(),
      })
      .strict()
      .refine((q) => q.after === undefined || q.before === undefined),
    req.query,
  );
  const { s, a } = await context(res, [], true);
  mergeState(
    s,
    await readState(
      ["chatRooms"],
      { chatRooms: { ids: [id] } },
      { fresh: true },
    ),
  );
  const room = roomFor(s, a, id);
  res.json(await readMessages(id, room.sequence, q.after, q.before));
});
chatRoutes.post("/chat/rooms", async (req, res) => {
  const input = validate(chatCreateSchema, req.body),
    key = req.header("Idempotency-Key");
  res.json(
    await chatCommand(
      res.locals.uid,
      key,
      req.path,
      input,
      (a) =>
        input.kind === "direct"
          ? chatId(
              "direct|" +
                [...new Set([a.employeeId, ...input.memberIds])]
                  .sort()
                  .join("|"),
            )
          : chatId("group|" + a.uid + "|" + key),
      input.memberIds,
      (s, a, id) => createRoom(s, a, id, input),
    ),
  );
});
chatRoutes.patch("/chat/rooms/:roomId", async (req, res) => {
  const id = param(req, "roomId"),
    input = validate(chatGroupSchema, req.body);
  res.json(
    await chatCommand(
      res.locals.uid,
      req.header("Idempotency-Key"),
      req.path,
      input,
      () => id,
      input.memberIds,
      (s, a) => updateGroup(s, a, id, input),
    ),
  );
});
chatRoutes.post("/chat/rooms/:roomId/messages", async (req, res) => {
  const id = param(req, "roomId"),
    input = validate(chatMessageSchema, req.body);
  res.json(
    await chatCommand(
      res.locals.uid,
      req.header("Idempotency-Key"),
      req.path,
      input,
      () => id,
      [],
      (s, a) => sendMessage(s, a, id, input.text),
    ),
  );
});
