import { Router } from "express";
import { avatarSchema } from "@hoosoo/shared";
import { validate } from "../../middleware/validate";
import { param } from "../../routes/helpers";
import { command } from "../../common/command";
import { normalizeAvatar, saveAvatar } from "./avatar.service";

export const avatarRoutes = Router();
for (const path of ["/me/avatar", "/employees/:employeeId/avatar"]) {
  avatarRoutes.patch(path, async (req, res) => {
    const employeeId = req.params.employeeId
      ? param(req, "employeeId")
      : undefined;
    const input = validate(avatarSchema, req.body);
    const image = await normalizeAvatar(input.image);
    res.json(
      await command(
        res.locals.uid,
        req.header("Idempotency-Key"),
        req.method + " " + req.path,
        input,
        (s, a) =>
          saveAvatar(s, a, employeeId ?? a.employeeId, image, input.version),
      ),
    );
  });
}
