# Architecture

## Overview

`@trysac/json-schema-forms` is a small, dependency-free TypeScript library published to npm as ES modules with type
declarations. Accessible HTML forms generated from a JSON Schema 2020-12 subset, with if/then/else visibility and a hand-written validator with JSON Pointer errors

## Modules

| Module | Responsibility |
|---|---|
| `src/index.ts` | Public API. Everything consumers import is exported from here. |

Add a row when you add a module. Internal modules are not re-exported unless they are part of the public API.

## Boundaries

- No runtime dependencies by default; any addition is justified in [STACK.md](STACK.md).
- No I/O at import time. Functions are pure unless their documentation says otherwise.
- Errors are thrown as built-in error types (`TypeError`, `RangeError`) with actionable messages.

## Build and distribution

`npm run build` compiles `src/` to `dist/` with `tsconfig.build.json`. Only `dist/` is published
(`files` in `package.json`).

## Decisions

Architectural decisions are recorded in [decisions/](decisions/), starting with
[0001](decisions/0001-record-architecture-decisions.md).
