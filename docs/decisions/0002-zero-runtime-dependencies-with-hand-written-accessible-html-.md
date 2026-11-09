# Zero runtime dependencies with hand-written accessible HTML renderer and validator

Status: accepted (generated, pending human review)

## Context

Enterprise applications need accessible form generation and validation directly aligned with JSON Schema 2020-12 without heavy UI framework bindings or conflicting external validator logic.

## Decision

Implement form compilation, validation, visibility evaluation, and HTML rendering with zero runtime dependencies. Use dev dependencies (ajv, fast-check, jsdom, axe-core, playwright) strictly for differential and accessibility testing.

## Consequences

Minimizes supply-chain attack surface and bundle size while ensuring deterministic, accessible output that meets WCAG 2.1 AA standards and matches standard JSON Schema 2020-12 semantics.
