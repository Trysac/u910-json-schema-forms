import { Ajv2020 } from "ajv/dist/2020.js";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compileForm, validate } from "../src/index.js";
import addressSchema from "./fixtures/schemas/address.json" with { type: "json" };
import basicSchema from "./fixtures/schemas/basic.json" with { type: "json" };

describe("Differential testing with Ajv 8 (2020-12)", () => {
  const schemas = [basicSchema, addressSchema];

  for (const [idx, rawSchema] of schemas.entries()) {
    it(`matches ajv 2020 validator on schema ${idx} for 300 values`, () => {
      const ajv = new Ajv2020({ allErrors: true, strict: false });
      const ajvValidate = ajv.compile(rawSchema);
      const form = compileForm(rawSchema);

      const arbitraryValue = fc.anything({
        maxDepth: 3,
        withBoxedValues: false,
        withMap: false,
        withSet: false,
      });

      let count = 0;
      fc.assert(
        fc.property(arbitraryValue, (v) => {
          count++;
          const ajvValid = Boolean(ajvValidate(v));
          const jsfErrors = validate(form, v);
          const jsfValid = jsfErrors.length === 0;
          return jsfValid === ajvValid;
        }),
        { numRuns: 300, seed: 3 },
      );
      expect(count).toBe(300);
    });
  }
});
