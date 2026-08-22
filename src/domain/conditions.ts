import type { Cond, ScopeCtx } from "./types";

/*
 * Interpreter for the declarative scope-condition language used by
 * tasks.json, deliverables.json and readiness.json. The library is data a
 * non-engineer can read and edit; this is the only code that understands it.
 *
 * §11b note: "sub11b" is true when the submitter of record changes AND the
 * practice will transact claims or remittance through EHR 360. Because
 * EHR 360 submits through its own clearinghouse, the submitter changes on
 * nearly every implementation — including Type B, where payer contracts are
 * untouched. Reading §11 as "verify only" on a Type B is the most
 * consequential scoping error available (v5 §11).
 */

export function evalCond(c: Cond, ctx: ScopeCtx): boolean {
  if ("always" in c) return true;
  if ("anyMove" in c) return Object.values(ctx.dispositions).includes("move");
  if ("mixedScope" in c) {
    const v = Object.values(ctx.dispositions);
    return v.includes("move") && v.includes("stay");
  }
  if ("moves" in c) return ctx.dispositions[c.moves] === "move";
  if ("stays" in c) return ctx.dispositions[c.stays] === "stay";
  if ("type" in c) return c.type.includes(ctx.implType);
  if ("sub11b" in c)
    return ctx.classification.submitterChanges &&
      (ctx.dispositions.claims === "move" || ctx.dispositions.remit === "move");
  if ("submitterChanges" in c) return ctx.classification.submitterChanges;
  if ("hasPrescribers" in c) return ctx.prescribers > 0;
  if ("all" in c) return c.all.every((x) => evalCond(x, ctx));
  if ("any" in c) return c.any.some((x) => evalCond(x, ctx));
  if ("not" in c) return !evalCond(c.not, ctx);
  throw new Error(`Unknown condition: ${JSON.stringify(c)}`);
}
