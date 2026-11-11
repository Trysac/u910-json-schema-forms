import { type ErrorCode, FormError } from "./errors.js";
import type { CompileOptions, Form, FormField, ResolvedSubschema } from "./types.js";

const UNSUPPORTED_KEYWORDS = new Set([
  "anyOf",
  "oneOf",
  "not",
  "patternProperties",
  "dependentSchemas",
  "dependentRequired",
  "$dynamicRef",
  "prefixItems",
  "contains",
]);

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  required: "This field is required",
  type: "Must be a <type>",
  minLength: "Must have at least N characters",
  maxLength: "Must have at most N characters",
  pattern: "Has the wrong format",
  minimum: "Must be at least N",
  maximum: "Must be at most N",
  exclusiveMinimum: "Must be greater than N",
  exclusiveMaximum: "Must be less than N",
  multipleOf: "multipleOf failed",
  enum: "Must be one of the allowed values",
  const: "Must be one of the allowed values",
  minItems: "minItems failed",
  maxItems: "maxItems failed",
  additionalProperties: "additionalProperties failed",
};

/**
 * Compiles a JSON Schema 2020-12 subset into a Form model.
 */
export function compileForm(schema: unknown, opts?: CompileOptions): Form {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    throw new FormError("invalid_schema", "Schema must be a non-null object");
  }

  const maxDepth = opts?.maxDepth ?? 32;
  const maxFields = opts?.maxFields ?? 1000;
  const messages: Record<ErrorCode, string> = {
    ...DEFAULT_MESSAGES,
    ...(opts?.messages ?? {}),
  };

  const rootRecord = schema as Record<string, unknown>;
  const defs = extractDefs(rootRecord);

  const resolvedRoot = resolveSchema(rootRecord, defs, 0, maxDepth, new Set<string>());

  // Collect form fields
  const fields: FormField[] = [];
  collectFields(resolvedRoot, "", "", fields, undefined, maxFields);

  return {
    rootSchema: resolvedRoot,
    fields,
    messages,
    maxDepth,
    maxFields,
  };
}

function extractDefs(root: Record<string, unknown>): Record<string, Record<string, unknown>> {
  const defs: Record<string, Record<string, unknown>> = {};
  const defsObj = root.$defs;
  if (defsObj && typeof defsObj === "object" && !Array.isArray(defsObj)) {
    for (const [k, v] of Object.entries(defsObj)) {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        defs[k] = v as Record<string, unknown>;
      }
    }
  }
  return defs;
}

function resolveSchema(
  schemaObj: Record<string, unknown>,
  defs: Record<string, Record<string, unknown>>,
  depth: number,
  maxDepth: number,
  seenRefs: Set<string>,
): ResolvedSubschema {
  if (depth > maxDepth) {
    throw new FormError("too_deep", `Schema nesting exceeded max depth of ${maxDepth}`);
  }

  for (const key of Object.keys(schemaObj)) {
    if (UNSUPPORTED_KEYWORDS.has(key) || key.startsWith("unevaluated")) {
      throw new FormError("unsupported_keyword", `Unsupported keyword: ${key}`);
    }
  }

  const currentObj = schemaObj;
  if ("$ref" in currentObj) {
    const ref = currentObj.$ref;
    if (typeof ref !== "string" || !ref.startsWith("#/$defs/")) {
      throw new FormError("unsupported_ref", `Unsupported $ref: ${String(ref)}`);
    }
    const defName = ref.slice("#/$defs/".length);
    if (seenRefs.has(ref)) {
      throw new FormError("ref_cycle", `Cycle detected in $ref: ${ref}`);
    }
    const target = defs[defName];
    if (!target) {
      throw new FormError("unsupported_ref", `Missing definition for $ref: ${ref}`);
    }
    const newSeen = new Set(seenRefs);
    newSeen.add(ref);
    const merged = { ...target };
    for (const [k, v] of Object.entries(currentObj)) {
      if (k !== "$ref") {
        merged[k] = v;
      }
    }
    return resolveSchema(merged, defs, depth + 1, maxDepth, newSeen);
  }

  const resolved: ResolvedSubschema = { raw: currentObj };

  if ("type" in currentObj) {
    const t = currentObj.type;
    if (
      typeof t === "string" ||
      (Array.isArray(t) && t.every((item) => typeof item === "string"))
    ) {
      resolved.type = t as string | string[];
    }
  }

  if ("enum" in currentObj && Array.isArray(currentObj.enum)) {
    resolved.enum = currentObj.enum;
  }

  if ("const" in currentObj) {
    resolved.const = currentObj.const;
  }

  if ("required" in currentObj && Array.isArray(currentObj.required)) {
    resolved.required = currentObj.required.filter((r): r is string => typeof r === "string");
  }

  if (
    "properties" in currentObj &&
    currentObj.properties &&
    typeof currentObj.properties === "object"
  ) {
    const entries: [string, ResolvedSubschema][] = [];
    for (const [k, v] of Object.entries(currentObj.properties as Record<string, unknown>)) {
      const sub = resolveSubschema(v, defs, depth + 1, maxDepth, seenRefs);
      if (sub) entries.push([k, sub]);
    }
    // fromEntries defines own properties, so names like "__proto__" are kept as keys.
    resolved.properties = Object.fromEntries(entries);
  }

  if ("additionalProperties" in currentObj) {
    if (typeof currentObj.additionalProperties === "boolean") {
      resolved.additionalProperties = currentObj.additionalProperties;
    } else {
      throw new FormError(
        "unsupported_keyword",
        "Unsupported keyword: additionalProperties with a schema (only true or false)",
      );
    }
  }

  if ("items" in currentObj) {
    resolved.items = resolveSubschema(currentObj.items, defs, depth + 1, maxDepth, seenRefs);
  }

  if (typeof currentObj.minItems === "number") resolved.minItems = currentObj.minItems;
  if (typeof currentObj.maxItems === "number") resolved.maxItems = currentObj.maxItems;
  if (typeof currentObj.minLength === "number") resolved.minLength = currentObj.minLength;
  if (typeof currentObj.maxLength === "number") resolved.maxLength = currentObj.maxLength;

  if (typeof currentObj.pattern === "string") {
    if (currentObj.pattern.length > 1000) {
      throw new FormError("invalid_schema", "Pattern exceeds 1000 characters");
    }
    resolved.pattern = currentObj.pattern;
    try {
      resolved.compiledPattern = new RegExp(currentObj.pattern, "u");
    } catch (e) {
      throw new FormError("invalid_schema", `Invalid regex pattern: ${(e as Error).message}`);
    }
  }

  if (typeof currentObj.minimum === "number") resolved.minimum = currentObj.minimum;
  if (typeof currentObj.maximum === "number") resolved.maximum = currentObj.maximum;
  if (typeof currentObj.exclusiveMinimum === "number")
    resolved.exclusiveMinimum = currentObj.exclusiveMinimum;
  if (typeof currentObj.exclusiveMaximum === "number")
    resolved.exclusiveMaximum = currentObj.exclusiveMaximum;
  if (typeof currentObj.multipleOf === "number") resolved.multipleOf = currentObj.multipleOf;

  if (Array.isArray(currentObj.allOf)) {
    resolved.allOf = currentObj.allOf
      .map((s) => resolveSubschema(s, defs, depth + 1, maxDepth, seenRefs))
      .filter((s): s is ResolvedSubschema => s !== undefined);
  }

  if ("if" in currentObj) {
    resolved.if = resolveSubschema(currentObj.if, defs, depth + 1, maxDepth, seenRefs);
  }
  if ("then" in currentObj) {
    // biome-ignore lint/suspicious/noThenProperty: JSON Schema keyword 'then'
    resolved.then = resolveSubschema(currentObj.then, defs, depth + 1, maxDepth, seenRefs);
  }
  if ("else" in currentObj) {
    resolved.else = resolveSubschema(currentObj.else, defs, depth + 1, maxDepth, seenRefs);
  }

  if (typeof currentObj.title === "string") resolved.title = currentObj.title;
  if (typeof currentObj.description === "string") resolved.description = currentObj.description;
  if ("default" in currentObj) resolved.default = currentObj.default;

  return resolved;
}

/**
 * Resolves a subschema position. A boolean `true` schema accepts everything and is treated as `{}`;
 * a boolean `false` schema is outside the supported subset and is rejected instead of being ignored.
 * Values that are not schemas at all are skipped.
 */
function resolveSubschema(
  value: unknown,
  defs: Record<string, Record<string, unknown>>,
  depth: number,
  maxDepth: number,
  seenRefs: Set<string>,
): ResolvedSubschema | undefined {
  if (value === true) {
    return resolveSchema({}, defs, depth, maxDepth, seenRefs);
  }
  if (value === false) {
    throw new FormError("unsupported_keyword", "Unsupported boolean schema: false");
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return resolveSchema(value as Record<string, unknown>, defs, depth, maxDepth, seenRefs);
  }
  return undefined;
}

function collectFields(
  schema: ResolvedSubschema,
  parentPointer: string,
  parentName: string,
  fields: FormField[],
  condition: FormField["condition"],
  maxFields: number,
): void {
  if (schema.properties) {
    for (const [propName, sub] of Object.entries(schema.properties)) {
      const pointer = `${parentPointer}/${propName.replace(/~/g, "~0").replace(/\//g, "~1")}`;
      const name = parentName ? `${parentName}.${propName}` : propName;

      if (fields.length >= maxFields) {
        throw new FormError("too_large", `Form exceeded maxFields limit of ${maxFields}`);
      }

      const effectiveType = Array.isArray(sub.type)
        ? (sub.type[0] ?? "string")
        : (sub.type ?? "string");

      fields.push({
        pointer,
        name,
        title: sub.title ?? propName,
        description: sub.description,
        type: effectiveType,
        subschema: sub,
        condition,
      });

      if (effectiveType === "object" && sub.properties) {
        collectFields(sub, pointer, name, fields, condition, maxFields);
      }
    }
  }

  if (schema.if) {
    if (schema.then) {
      collectFields(
        schema.then,
        parentPointer,
        parentName,
        fields,
        {
          type: "then",
          parentPointer,
          ifSchema: schema.if,
        },
        maxFields,
      );
    }
    if (schema.else) {
      collectFields(
        schema.else,
        parentPointer,
        parentName,
        fields,
        {
          type: "else",
          parentPointer,
          ifSchema: schema.if,
        },
        maxFields,
      );
    }
  }

  if (schema.allOf) {
    for (const part of schema.allOf) {
      collectFields(part, parentPointer, parentName, fields, condition, maxFields);
    }
  }
}
