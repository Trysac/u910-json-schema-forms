import type { Form } from "./types.js";
import { validateSubschema } from "./validate.js";

/**
 * Evaluates which fields are currently visible given the value.
 * Fields declared under `then` are visible when `if` validates.
 * Fields declared under `else` are visible when `if` fails.
 * Returned fields are in schema definition order.
 */
export function visibleFields(form: Form, value: unknown): string[] {
  const result: string[] = [];
  const maxDepth = 64;

  for (const field of form.fields) {
    if (!field.condition) {
      result.push(field.pointer);
      continue;
    }

    const parentVal = getPointerValue(value, field.condition.parentPointer);
    const ifErrors: import("./errors.js").FieldError[] = [];
    const ifValid = validateSubschema(
      field.condition.ifSchema,
      parentVal,
      field.condition.parentPointer,
      ifErrors,
      0,
      maxDepth,
      form.messages,
    );

    if (field.condition.type === "then" && ifValid) {
      result.push(field.pointer);
    } else if (field.condition.type === "else" && !ifValid) {
      result.push(field.pointer);
    }
  }

  return result;
}

export function getPointerValue(root: unknown, pointer: string): unknown {
  if (!pointer || pointer === "") return root;
  const tokens = pointer
    .split("/")
    .slice(1)
    .map((t) => t.replace(/~1/g, "/").replace(/~0/g, "~"));
  let cur: unknown = root;
  for (const token of tokens) {
    if (cur === null || typeof cur !== "object") return undefined;
    if (Array.isArray(cur)) {
      const idx = Number.parseInt(token, 10);
      if (Number.isNaN(idx) || idx < 0 || idx >= cur.length) return undefined;
      cur = cur[idx];
    } else {
      const obj = cur as Record<string, unknown>;
      if (!Object.hasOwn(obj, token)) return undefined;
      cur = obj[token];
    }
  }
  return cur;
}
