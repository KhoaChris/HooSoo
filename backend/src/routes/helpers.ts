import type { Router, Request, Response } from "express";
import type { z } from "zod";
import {
  idSchema,
  querySchema,
  type State,
  type Actor,
  type Query,
  type Table,
} from "@hoosoo/shared";
import { validate } from "../middleware/validate";
import { command } from "../common/command";
import { requestState, type RequestScope } from "./read-context";

export const param = (req: Request, key: string) =>
  validate(idSchema, req.params[key]);
export const query = (req: Request) => validate(querySchema, req.query);
export async function context(
  res: Response,
  selected: readonly Table[] = [],
  selfOnly = false,
  scope?: RequestScope,
) {
  return requestState(res.locals.uid as string, selected, selfOnly, scope);
}
export function handlers(api: Router) {
  const get = (
    path: string,
    selected: readonly Table[],
    fn: (s: State, a: Actor, q: Query, req: Request) => unknown,
  ) =>
    api.get(path, async (req, res) => {
      const q = query(req);
      for (const value of Object.values(req.params)) validate(idSchema, value);
      const { s, a } = await context(res, selected, path === "/me", {
        path,
        query: q,
        params: req.params,
      });
      res.json(fn(s, a, q, req));
    });
  function write<T>(
    method: "post" | "patch",
    path: string,
    schema: z.ZodType<T>,
    fn: (s: State, a: Actor, input: T, req: Request) => unknown,
  ) {
    api[method](path, async (req, res) => {
      for (const value of Object.values(req.params)) validate(idSchema, value);
      const input = validate(schema, req.body);
      const result = await command(
        res.locals.uid,
        req.header("Idempotency-Key"),
        req.method + " " + req.path,
        input,
        (s, a) => fn(s, a, input, req),
      );
      res.json(result);
    });
  }
  return { get, write };
}
