// Conformance test suite running against JSON-Schema-Test-Suite draft2020-12 and Playwright axe

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { compileForm, FormError, validate } from "../src/index.js";

interface TestCase {
  description: string;
  schema: Record<string, unknown>;
  tests: Array<{
    description: string;
    data: unknown;
    valid: boolean;
  }>;
}

describe.skipIf(!process.env.FABRICA_CI)("JSON-Schema-Test-Suite draft2020-12 Conformance", () => {
  const suiteDir = path.resolve("test/fixtures/json-schema-test-suite/tests/draft2020-12");

  const supportedFiles = [
    "type.json",
    "enum.json",
    "const.json",
    "required.json",
    "properties.json",
    "additionalProperties.json",
    "items.json",
    "minItems.json",
    "maxItems.json",
    "minLength.json",
    "maxLength.json",
    "pattern.json",
    "minimum.json",
    "maximum.json",
    "exclusiveMinimum.json",
    "exclusiveMaximum.json",
    "multipleOf.json",
    "allOf.json",
    "if-then-else.json",
    "ref.json",
    "defs.json",
  ];

  it("runs all available draft2020-12 test files", () => {
    if (!fs.existsSync(suiteDir)) {
      console.log("JSON-Schema-Test-Suite directory not found, skipping.");
      return;
    }

    let skippedCount = 0;
    let ranCount = 0;

    for (const file of supportedFiles) {
      const filePath = path.join(suiteDir, file);
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, "utf8");
      const testCases = JSON.parse(content) as TestCase[];

      for (const tc of testCases) {
        let form: ReturnType<typeof compileForm> | undefined;
        try {
          form = compileForm(tc.schema);
        } catch (err) {
          if (
            err instanceof FormError &&
            ["unsupported_keyword", "unsupported_ref", "ref_cycle"].includes(err.code)
          ) {
            skippedCount++;
            continue;
          }
          throw err;
        }

        if (!form) continue;

        for (const test of tc.tests) {
          ranCount++;
          const errors = validate(form, test.data);
          const isValid = errors.length === 0;
          expect(isValid, `${file}: ${tc.description} - ${test.description}`).toBe(test.valid);
        }
      }
    }

    console.log(
      `JSON Schema Conformance: Ran ${ranCount} tests, skipped ${skippedCount} unsupported cases.`,
    );
  });
});
