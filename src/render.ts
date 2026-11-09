import type { FieldError } from "./errors.js";
import type { Form, FormField } from "./types.js";
import { getPointerValue, visibleFields } from "./visibility.js";

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Renders a Form model into accessible HTML fragment markup.
 */
export function renderHtml(
  form: Form,
  opts?: {
    value?: unknown;
    errors?: FieldError[];
    idPrefix?: string;
  },
): string {
  const idPrefix = opts?.idPrefix ?? "jsf";
  const value = opts?.value;
  const errors = opts?.errors ?? [];
  const visibleSet = new Set(visibleFields(form, value));

  const errorsByPointer = new Map<string, FieldError[]>();
  for (const err of errors) {
    const arr = errorsByPointer.get(err.path) ?? [];
    arr.push(err);
    errorsByPointer.set(err.path, arr);
  }

  const outputParts: string[] = [];
  let fieldCounter = 0;

  for (const field of form.fields) {
    if (!visibleSet.has(field.pointer)) {
      continue;
    }

    const id = `${idPrefix}-${fieldCounter++}`;
    const fieldErrors = errorsByPointer.get(field.pointer) ?? [];
    const fieldValue = getPointerValue(value, field.pointer);
    const isRequired = isFieldRequired(form, field);

    outputParts.push(renderField(field, id, fieldValue, isRequired, fieldErrors));
  }

  return outputParts.join("\n");
}

function isFieldRequired(form: Form, field: FormField): boolean {
  const parts = field.pointer
    .split("/")
    .slice(1)
    .map((t) => t.replace(/~1/g, "/").replace(/~0/g, "~"));
  const lastProp = parts[parts.length - 1];
  if (!lastProp) return false;

  // Check direct required on field condition or parent schema
  if (field.condition) {
    if (field.condition.type === "then" && form.rootSchema.then?.required?.includes(lastProp)) {
      return true;
    }
    if (field.condition.type === "else" && form.rootSchema.else?.required?.includes(lastProp)) {
      return true;
    }
  }

  if (form.rootSchema.required?.includes(lastProp)) {
    return true;
  }
  return false;
}

function renderField(
  field: FormField,
  id: string,
  value: unknown,
  isRequired: boolean,
  errors: FieldError[],
): string {
  const hasError = errors.length > 0;
  const sub = field.subschema;
  const escapedTitle = escapeHtml(field.title);

  // Description / hint
  const hintId = field.description ? `${id}-hint` : undefined;
  const errorId = hasError ? `${id}-error` : undefined;
  const describedByParts = [hintId, errorId].filter((x): x is string => Boolean(x));
  const ariaDescribedby = describedByParts.length > 0 ? describedByParts.join(" ") : undefined;

  // Nested object rendered as fieldset
  if (field.type === "object") {
    return `<fieldset id="${id}"><legend>${escapedTitle}</legend></fieldset>`;
  }

  // Radio group for enum of 2 to 5 strings
  if (
    sub.enum &&
    Array.isArray(sub.enum) &&
    sub.enum.length >= 2 &&
    sub.enum.length <= 5 &&
    sub.enum.every((x) => typeof x === "string")
  ) {
    const legend = `<legend>${escapedTitle}</legend>`;
    const hint = field.description
      ? `<p id="${hintId}" class="jsf-hint">${escapeHtml(field.description)}</p>`
      : "";
    const radioParts: string[] = [];

    for (let i = 0; i < sub.enum.length; i++) {
      const optVal = sub.enum[i] as string;
      const optId = `${id}-${i}`;
      const isChecked = value === optVal ? " checked" : "";
      radioParts.push(
        `<label for="${optId}"><input id="${optId}" name="${escapeHtml(field.name)}" type="radio" value="${escapeHtml(optVal)}"${isChecked}> ${escapeHtml(optVal)}</label>`,
      );
    }

    const errorHtml = hasError
      ? `<p id="${errorId}" class="jsf-error">${escapeHtml(errors[0]?.message ?? "")} </p>`
      : "";

    return `<fieldset id="${id}">${legend}${hint}${radioParts.join("")}${errorHtml}</fieldset>`;
  }

  // Select for longer enum (> 5)
  if (sub.enum && Array.isArray(sub.enum) && sub.enum.length > 5) {
    const label = `<label for="${id}">${escapedTitle}</label>`;
    const hint = field.description
      ? `<p id="${hintId}" class="jsf-hint">${escapeHtml(field.description)}</p>`
      : "";
    const attrs = buildAttributes({
      id,
      name: field.name,
      required: isRequired,
      "aria-invalid": hasError ? "true" : undefined,
      "aria-describedby": ariaDescribedby,
    });
    const options: string[] = ['<option value="">-- Select --</option>'];
    for (const opt of sub.enum) {
      const optStr = String(opt);
      const isSelected = value === opt ? " selected" : "";
      options.push(
        `<option value="${escapeHtml(optStr)}"${isSelected}>${escapeHtml(optStr)}</option>`,
      );
    }
    const select = `<select ${attrs}>${options.join("")}</select>`;
    const errorHtml = hasError
      ? `<p id="${errorId}" class="jsf-error">${escapeHtml(errors[0]?.message ?? "")}</p>`
      : "";
    return [label, hint, select, errorHtml].filter(Boolean).join("");
  }

  // Checkbox for boolean
  if (field.type === "boolean") {
    const isChecked = value === true ? " checked" : "";
    const attrs = buildAttributes({
      id,
      name: field.name,
      type: "checkbox",
      required: isRequired,
      "aria-invalid": hasError ? "true" : undefined,
      "aria-describedby": ariaDescribedby,
    });
    const input = `<input ${attrs}${isChecked}>`;
    const label = `<label for="${id}">${input} ${escapedTitle}</label>`;
    const hint = field.description
      ? `<p id="${hintId}" class="jsf-hint">${escapeHtml(field.description)}</p>`
      : "";
    const errorHtml = hasError
      ? `<p id="${errorId}" class="jsf-error">${escapeHtml(errors[0]?.message ?? "")}</p>`
      : "";
    return [hint, label, errorHtml].filter(Boolean).join("");
  }

  // Standard text/number inputs
  const inputType = field.type === "integer" || field.type === "number" ? "number" : "text";
  const inputAttrs = buildAttributes({
    id,
    name: field.name,
    type: inputType,
    required: isRequired,
    minlength: sub.minLength,
    maxlength: sub.maxLength,
    pattern: sub.pattern,
    min: sub.minimum ?? sub.exclusiveMinimum,
    max: sub.maximum ?? sub.exclusiveMaximum,
    step: sub.multipleOf ?? (field.type === "integer" ? 1 : undefined),
    "aria-invalid": hasError ? "true" : undefined,
    "aria-describedby": ariaDescribedby,
  });

  const valAttr =
    value !== undefined && value !== null && value !== "" && typeof value !== "object"
      ? ` value="${escapeHtml(String(value))}"`
      : "";
  const input = `<input ${inputAttrs}${valAttr}>`;
  const label = `<label for="${id}">${escapedTitle}</label>`;
  const hint = field.description
    ? `<p id="${hintId}" class="jsf-hint">${escapeHtml(field.description)}</p>`
    : "";
  const errorHtml = hasError
    ? `<p id="${errorId}" class="jsf-error">${escapeHtml(errors[0]?.message ?? "")}</p>`
    : "";

  return [label, hint, input, errorHtml].filter(Boolean).join("");
}

interface RawAttrs {
  id: string;
  name: string;
  type?: string | undefined;
  required?: boolean | undefined;
  minlength?: number | undefined;
  maxlength?: number | undefined;
  pattern?: string | undefined;
  min?: number | undefined;
  max?: number | undefined;
  step?: number | undefined;
  "aria-invalid"?: string | undefined;
  "aria-describedby"?: string | undefined;
}

function buildAttributes(raw: RawAttrs): string {
  const orderedKeys: (keyof RawAttrs)[] = [
    "id",
    "name",
    "type",
    "required",
    "minlength",
    "maxlength",
    "pattern",
    "min",
    "max",
    "step",
    "aria-invalid",
    "aria-describedby",
  ];

  const parts: string[] = [];
  for (const k of orderedKeys) {
    const val = raw[k];
    if (val === undefined || val === false) continue;
    if (val === true) {
      parts.push(k);
    } else {
      parts.push(`${k}="${escapeHtml(String(val))}"`);
    }
  }
  return parts.join(" ");
}
