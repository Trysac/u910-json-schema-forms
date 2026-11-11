import { type ErrorCode, type FieldError, FormError } from "./errors.js";
import type { Form, ResolvedSubschema, ValidateOptions } from "./types.js";

const KEYWORD_ORDER: Record<ErrorCode, number> = {
  required: 1,
  type: 2,
  enum: 3,
  const: 4,
  minLength: 5,
  maxLength: 6,
  pattern: 7,
  minimum: 8,
  maximum: 9,
  exclusiveMinimum: 10,
  exclusiveMaximum: 11,
  multipleOf: 12,
  minItems: 13,
  maxItems: 14,
  additionalProperties: 15,
};

function checkValueDepth(val: unknown, currentDepth: number, maxDepth: number): void {
  if (currentDepth > maxDepth) {
    throw new FormError("too_deep", `Value nesting exceeded max depth of ${maxDepth}`);
  }
  if (val && typeof val === "object") {
    if (Array.isArray(val)) {
      for (const item of val) {
        checkValueDepth(item, currentDepth + 1, maxDepth);
      }
    } else {
      for (const v of Object.values(val as Record<string, unknown>)) {
        checkValueDepth(v, currentDepth + 1, maxDepth);
      }
    }
  }
}

/**
 * Validates a value against a compiled Form.
 */
export function validate(form: Form, value: unknown, opts?: ValidateOptions): FieldError[] {
  const maxDepth = opts?.maxDepth ?? 64;
  checkValueDepth(value, 0, maxDepth);
  const errors: FieldError[] = [];
  validateSubschema(form.rootSchema, value, "", errors, 0, maxDepth, form.messages);
  return sortErrors(errors);
}

export function sortErrors(errors: FieldError[]): FieldError[] {
  return [...errors].sort((a, b) => {
    if (a.path !== b.path) {
      return a.path < b.path ? -1 : 1;
    }
    return (KEYWORD_ORDER[a.code] ?? 99) - (KEYWORD_ORDER[b.code] ?? 99);
  });
}

export function validateSubschema(
  schema: ResolvedSubschema,
  value: unknown,
  pointer: string,
  errors: FieldError[],
  depth: number,
  maxDepth: number,
  messages: Record<ErrorCode, string>,
): boolean {
  if (depth > maxDepth) {
    throw new FormError("too_deep", `Value nesting exceeded max depth of ${maxDepth}`);
  }

  const startCount = errors.length;

  // Type validation
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const matchesAny = types.some((t) => checkType(t, value));
    if (!matchesAny) {
      const expectedStr = Array.isArray(schema.type) ? schema.type.join(" or ") : schema.type;
      const msg = messages.type.replace("<type>", expectedStr);
      errors.push({ path: pointer, code: "type", message: msg });
    }
  }

  // Enum
  if (schema.enum !== undefined) {
    const matched = schema.enum.some((item) => deepEqual(item, value));
    if (!matched) {
      errors.push({ path: pointer, code: "enum", message: messages.enum });
    }
  }

  // Const
  if ("const" in schema && schema.const !== undefined) {
    if (!deepEqual(schema.const, value)) {
      errors.push({ path: pointer, code: "const", message: messages.const });
    }
  }

  // String keywords
  if (typeof value === "string") {
    const codePointCount = Array.from(value).length;

    if (schema.minLength !== undefined && codePointCount < schema.minLength) {
      const msg = messages.minLength.replace("N", String(schema.minLength));
      errors.push({ path: pointer, code: "minLength", message: msg });
    }

    if (schema.maxLength !== undefined && codePointCount > schema.maxLength) {
      const msg = messages.maxLength.replace("N", String(schema.maxLength));
      errors.push({ path: pointer, code: "maxLength", message: msg });
    }

    if (schema.compiledPattern !== undefined && !schema.compiledPattern.test(value)) {
      errors.push({ path: pointer, code: "pattern", message: messages.pattern });
    }
  }

  // Numeric keywords
  if (typeof value === "number" && !Number.isNaN(value)) {
    if (schema.minimum !== undefined && value < schema.minimum) {
      const msg = messages.minimum.replace("N", String(schema.minimum));
      errors.push({ path: pointer, code: "minimum", message: msg });
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      const msg = messages.maximum.replace("N", String(schema.maximum));
      errors.push({ path: pointer, code: "maximum", message: msg });
    }
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      const msg = messages.exclusiveMinimum.replace("N", String(schema.exclusiveMinimum));
      errors.push({ path: pointer, code: "exclusiveMinimum", message: msg });
    }
    if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
      const msg = messages.exclusiveMaximum.replace("N", String(schema.exclusiveMaximum));
      errors.push({ path: pointer, code: "exclusiveMaximum", message: msg });
    }
    if (schema.multipleOf !== undefined) {
      const m = schema.multipleOf;
      const q = value / m;
      const isInt =
        Number.isInteger(q) || Math.abs(q - Math.round(q)) <= 1e-9 * Math.max(1, Math.abs(q));
      if (!isInt) {
        errors.push({ path: pointer, code: "multipleOf", message: messages.multipleOf });
      }
    }
  }

  // Array keywords
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push({ path: pointer, code: "minItems", message: messages.minItems });
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push({ path: pointer, code: "maxItems", message: messages.maxItems });
    }
    if (schema.items) {
      for (let i = 0; i < value.length; i++) {
        const itemPointer = `${pointer}/${i}`;
        validateSubschema(
          schema.items,
          value[i],
          itemPointer,
          errors,
          depth + 1,
          maxDepth,
          messages,
        );
      }
    }
  }

  // Object keywords
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;

    if (schema.required) {
      for (const req of schema.required) {
        if (!Object.hasOwn(obj, req)) {
          const reqPointer = `${pointer}/${req.replace(/~/g, "~0").replace(/\//g, "~1")}`;
          errors.push({ path: reqPointer, code: "required", message: messages.required });
        }
      }
    }

    if (schema.properties) {
      for (const [k, propSchema] of Object.entries(schema.properties)) {
        if (Object.hasOwn(obj, k)) {
          const propPointer = `${pointer}/${k.replace(/~/g, "~0").replace(/\//g, "~1")}`;
          validateSubschema(propSchema, obj[k], propPointer, errors, depth + 1, maxDepth, messages);
        }
      }
    }

    if (schema.additionalProperties === false) {
      const allowed = new Set(schema.properties ? Object.keys(schema.properties) : []);
      for (const k of Object.keys(obj)) {
        if (!allowed.has(k)) {
          const extraPointer = `${pointer}/${k.replace(/~/g, "~0").replace(/\//g, "~1")}`;
          errors.push({
            path: extraPointer,
            code: "additionalProperties",
            message: messages.additionalProperties,
          });
        }
      }
    }
  }

  // allOf
  if (schema.allOf) {
    for (const part of schema.allOf) {
      validateSubschema(part, value, pointer, errors, depth + 1, maxDepth, messages);
    }
  }

  // if / then / else
  if (schema.if) {
    const ifErrors: FieldError[] = [];
    const ifPassed = validateSubschema(
      schema.if,
      value,
      pointer,
      ifErrors,
      depth + 1,
      maxDepth,
      messages,
    );
    if (ifPassed && schema.then) {
      validateSubschema(schema.then, value, pointer, errors, depth + 1, maxDepth, messages);
    } else if (!ifPassed && schema.else) {
      validateSubschema(schema.else, value, pointer, errors, depth + 1, maxDepth, messages);
    }
  }

  return errors.length === startCount;
}

function checkType(expectedType: string, val: unknown): boolean {
  switch (expectedType) {
    case "null":
      return val === null;
    case "boolean":
      return typeof val === "boolean";
    case "string":
      return typeof val === "string";
    case "number":
      return typeof val === "number" && !Number.isNaN(val);
    case "integer":
      return typeof val === "number" && Number.isInteger(val);
    case "object":
      return val !== null && typeof val === "object" && !Array.isArray(val);
    case "array":
      return Array.isArray(val);
    default:
      return true;
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object" || a === null || b === null) return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (Array.isArray(b)) return false;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  if (aKeys.length !== bKeys.length) return false;

  for (const k of aKeys) {
    if (!Object.hasOwn(bObj, k) || !deepEqual(aObj[k], bObj[k])) {
      return false;
    }
  }

  return true;
}
