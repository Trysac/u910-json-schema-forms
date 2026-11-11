# Architecture

`@trysac/json-schema-forms` compiles JSON Schema 2020-12 definitions into an internal `Form` model, renders accessible HTML fragments, and validates form values.

## Modules

1. `src/compile.ts`: Traverses and resolves schema definitions, checking for recursion depth (`maxDepth`), field count limits (`maxFields`), and unsupported keywords or reference cycles. Collects pre-order field representations.
2. `src/validate.ts`: Hand-written, depth-limited recursive validator implementing the supported 2020-12 keyword subset. Collects errors as RFC 6901 JSON pointers and sorts them according to schema definition rules.
3. `src/visibility.ts`: Evaluates conditional visibility (`if`/`then`/`else`) against current form values and returns active JSON Pointer paths.
4. `src/render.ts`: Emits HTML element fragments matching WCAG 2.1 AA specifications with strict attribute ordering and HTML escaping.
