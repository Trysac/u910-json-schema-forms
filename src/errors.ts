/**
 * Error types and codes for JSON Schema form compilation and validation.
 */

export type FormErrorCode =
  | "unsupported_keyword"
  | "unsupported_ref"
  | "ref_cycle"
  | "too_deep"
  | "too_large"
  | "invalid_schema";

/**
 * Base error class for all compilation errors in the library.
 */
export class FormError extends Error {
  readonly code: FormErrorCode;

  constructor(code: FormErrorCode, message: string) {
    super(message);
    this.name = "FormError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export type ErrorCode =
  | "required"
  | "type"
  | "enum"
  | "const"
  | "minLength"
  | "maxLength"
  | "pattern"
  | "minimum"
  | "maximum"
  | "exclusiveMinimum"
  | "exclusiveMaximum"
  | "multipleOf"
  | "minItems"
  | "maxItems"
  | "additionalProperties";

/**
 * Validation error tied to a specific JSON Pointer path.
 */
export interface FieldError {
  /** RFC 6901 JSON Pointer, "" for the root */
  path: string;
  code: ErrorCode;
  message: string;
}
