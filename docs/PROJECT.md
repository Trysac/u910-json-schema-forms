# Project record: json-schema-forms\n\n## Objective\n\nGenerate accessible HTML forms from a JSON Schema 2020-12 subset. This utility is for developers needing type-safe, consistent form rendering and validation that matches server-side JSON Schema expectations for data integrity and accessibility.\n\n## Scope\n\n- Compilation of JSON Schema 2020-12 subset to form models.\n- Accessible HTML fragment rendering (WCAG 2.1 AA).\n- Deterministic validation using RFC 6901 JSON Pointer error paths.\n- Handling of conditional visibility (`if`/`then`/`else`).\n\n## Out of Scope\n\n- Support for arrays of objects with UI-driven add/remove buttons.\n- File upload handling.\n- Format-based validation (e.g., date-time, email).\n- Handling of remote JSON Schema references ($ref with non-local URLs).\n- Built-in CSS styling or framework-specific bindings (e.g., React, Vue components).

## Factory run u910 (measured from API usage)

| Phase | Model | Batch | Input | Output | Cache write | Cache read | Cost (USD) |
|---|---|---|---|---|---|---|---|
| generation | google/gemini-3.8-flash | yes | 6418 | 16970 | 0 | 0 | 0.0685 |
| fix-1 | google/gemini-3.8-flash | no | 284488 | 6715 | 0 | 670077 | 0.2888 |
| fix-2 | google/gemini-3.8-flash | no | 301674 | 4254 | 0 | 739002 | 0.2976 |
| fix-3 | google/gemini-3.8-flash | no | 315955 | 2050 | 0 | 708579 | 0.2978 |
| audit | google/gemini-3.1-flash-lite | no | 88824 | 417 | 0 | 140146 | 0.0263 |
| docs | google/gemini-3.1-flash-lite | no | 21482 | 1568 | 0 | 0 | 0.0077 |

Total: $0.9867. Prices: vertex line, as measured by its adapter.
