import type { ErrorCode } from "./errors.js";

export interface CompileOptions {
  /** Maximum recursion depth for schemas (default: 32) */
  maxDepth?: number;
  /** Maximum number of compiled fields allowed (default: 1_000) */
  maxFields?: number;
  /** Custom user-facing error messages */
  messages?: Partial<Record<ErrorCode, string>>;
}

export interface ValidateOptions {
  /** Maximum recursion depth for values (default: 64) */
  maxDepth?: number;
}

export interface RenderOptions {
  /** The value being filled into the form */
  value?: unknown;
  /** Validation errors to display alongside fields */
  errors?: import("./errors.js").FieldError[];
  /** Prefix for generated HTML element IDs (default: 'jsf') */
  idPrefix?: string;
}

export interface ResolvedSubschema {
  raw: Record<string, unknown>;
  type?: string | string[] | undefined;
  enum?: unknown[] | undefined;
  const?: unknown;
  required?: string[] | undefined;
  properties?: Record<string, ResolvedSubschema> | undefined;
  additionalProperties?: boolean | undefined;
  items?: ResolvedSubschema | undefined;
  minItems?: number | undefined;
  maxItems?: number | undefined;
  minLength?: number | undefined;
  maxLength?: number | undefined;
  pattern?: string | undefined;
  compiledPattern?: RegExp | undefined;
  minimum?: number | undefined;
  maximum?: number | undefined;
  exclusiveMinimum?: number | undefined;
  exclusiveMaximum?: number | undefined;
  multipleOf?: number | undefined;
  allOf?: ResolvedSubschema[] | undefined;
  if?: ResolvedSubschema | undefined;
  then?: ResolvedSubschema | undefined;
  else?: ResolvedSubschema | undefined;
  title?: string | undefined;
  description?: string | undefined;
  default?: unknown;
}

export interface FormField {
  pointer: string; // RFC 6901 JSON pointer (e.g. "/country", "/address/city")
  name: string; // dotted name (e.g. "country", "address.city")
  title: string;
  description?: string | undefined;
  type: string;
  subschema: ResolvedSubschema;
  condition?:
    | {
        type: "then" | "else";
        parentPointer: string;
        ifSchema: ResolvedSubschema;
      }
    | undefined;
}

export interface Form {
  readonly rootSchema: ResolvedSubschema;
  readonly fields: readonly FormField[];
  readonly messages: Record<ErrorCode, string>;
  readonly maxDepth: number;
  readonly maxFields: number;
}
