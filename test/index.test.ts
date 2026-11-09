import { describe, expect, it } from "vitest";
import { compileForm, FormError, renderHtml, validate, visibleFields } from "../src/index.js";

describe("Acceptance tests from specification", () => {
  it("compiles object with required name and renders expected label and input", () => {
    const form = compileForm({
      type: "object",
      properties: {
        name: { type: "string", title: "Name", minLength: 1 },
      },
      required: ["name"],
    });
    const html = renderHtml(form);
    expect(html).toContain('<label for="jsf-0">Name</label>');
    expect(html).toContain('<input id="jsf-0" name="name" type="text" required minlength="1">');
  });

  it("renders aria-invalid, aria-describedby, and error paragraph when errors are present", () => {
    const form = compileForm({
      type: "object",
      properties: {
        name: { type: "string", title: "Name", minLength: 1 },
      },
      required: ["name"],
    });
    const errors = validate(form, { name: "" });
    const html = renderHtml(form, { value: { name: "" }, errors });
    expect(html).toContain(
      '<input id="jsf-0" name="name" type="text" required minlength="1" aria-invalid="true" aria-describedby="jsf-0-error">',
    );
    expect(html).toContain(
      '<p id="jsf-0-error" class="jsf-error">Must have at least 1 characters</p>',
    );
  });

  const countrySchema = {
    type: "object",
    properties: {
      country: {
        type: "string",
        title: "Country",
        enum: ["US", "CA"],
      },
    },
    required: ["country"],
    if: {
      properties: {
        country: { const: "US" },
      },
    },
    // biome-ignore lint/suspicious/noThenProperty: JSON Schema keyword 'then'
    then: {
      properties: {
        zip: {
          type: "string",
          title: "ZIP code",
          pattern: "^[0-9]{5}$",
        },
      },
      required: ["zip"],
    },
    else: {
      properties: {
        postcode: {
          type: "string",
          title: "Postal code",
        },
      },
    },
  };

  it("evaluates visibleFields correctly for countrySchema (if/then/else condition)", () => {
    const form = compileForm(countrySchema);
    expect(visibleFields(form, { country: "US" })).toEqual(["/country", "/zip"]);
    expect(visibleFields(form, { country: "CA" })).toEqual(["/country", "/postcode"]);
    expect(visibleFields(form, {})).toEqual(["/country", "/zip"]);
  });

  it("validates countrySchema values matching acceptance items", () => {
    const form = compileForm(countrySchema);
    expect(validate(form, { country: "US", zip: "1234" })).toEqual([
      { path: "/zip", code: "pattern", message: "Has the wrong format" },
    ]);
    const usOnlyErrors = validate(form, { country: "US" });
    expect(usOnlyErrors).toHaveLength(1);
    expect(usOnlyErrors[0]?.path).toBe("/zip");
    expect(usOnlyErrors[0]?.code).toBe("required");
    expect(validate(form, { country: "CA" })).toEqual([]);
  });

  it("validates age integer with minimum 18 in specified keyword order", () => {
    const form = compileForm({
      type: "object",
      properties: {
        age: { type: "integer", minimum: 18 },
      },
    });
    const errors17_5 = validate(form, { age: 17.5 });
    expect(errors17_5.map((e) => e.code)).toEqual(["type", "minimum"]);
    expect(errors17_5[0]?.path).toBe("/age");

    expect(validate(form, { age: 18.0 })).toEqual([]);
    expect(validate(form, { age: "18" }).map((e) => e.code)).toEqual(["type"]);
  });

  it("counts Unicode code points for minLength (rejects poop emoji when minLength 2)", () => {
    const form = compileForm({
      type: "object",
      properties: {
        str: { type: "string", minLength: 2 },
      },
    });
    const poopErrors = validate(form, { str: "\u{1F4A9}" });
    expect(poopErrors).toHaveLength(1);
    expect(poopErrors[0]?.code).toBe("minLength");

    const okErrors = validate(form, { str: "ab" });
    expect(okErrors).toEqual([]);
  });

  it("escapes label text and renders appropriate controls for enum, boolean, and nested object", () => {
    const form = compileForm({
      type: "object",
      properties: {
        escaped: { type: "string", title: '<b>"x"</b>' },
        radioEnum: { type: "string", title: "Radio", enum: ["A", "B"] },
        selectEnum: {
          type: "string",
          title: "Select",
          enum: ["1", "2", "3", "4", "5", "6"],
        },
        flag: { type: "boolean", title: "Active" },
        address: { type: "object", title: "Address", properties: { city: { type: "string" } } },
      },
    });
    const html = renderHtml(form);
    expect(html).toContain("&lt;b&gt;&quot;x&quot;&lt;/b&gt;");
    expect(html).toContain('<input id="jsf-1-0" name="radioEnum" type="radio" value="A">');
    expect(html).toContain('<select id="jsf-2" name="selectEnum">');
    expect(html).toContain('<input id="jsf-3" name="flag" type="checkbox"> Active</label>');
    expect(html).toContain('<fieldset id="jsf-4"><legend>Address</legend></fieldset>');
  });

  it("throws typed FormError for invalid schemas, cycles, depth, and size limits", () => {
    expect(() => compileForm({ $ref: "https://example.com/s.json" })).toThrowError(
      expect.objectContaining({ code: "unsupported_ref" }),
    );

    expect(() =>
      compileForm({
        $defs: {
          node: { $ref: "#/$defs/node" },
        },
        $ref: "#/$defs/node",
      }),
    ).toThrowError(expect.objectContaining({ code: "ref_cycle" }));

    expect(() => compileForm({ anyOf: [{ type: "string" }] })).toThrowError(
      expect.objectContaining({ code: "unsupported_keyword" }),
    );

    // 33 levels deep schema
    let deepSchema: Record<string, unknown> = { type: "string" };
    for (let i = 0; i < 33; i++) {
      deepSchema = { type: "object", properties: { next: deepSchema } };
    }
    expect(() => compileForm(deepSchema)).toThrowError(
      expect.objectContaining({ code: "too_deep" }),
    );

    // 1_001 fields throws too_large
    const largeProps: Record<string, unknown> = {};
    for (let i = 0; i < 1001; i++) {
      largeProps[`f_${i}`] = { type: "string" };
    }
    expect(() => compileForm({ type: "object", properties: largeProps })).toThrowError(
      expect.objectContaining({ code: "too_large" }),
    );

    // Value nested 65 levels passed to validate throws too_deep
    const shallowForm = compileForm({ type: "object" });
    let deepVal: unknown = "leaf";
    for (let i = 0; i < 65; i++) {
      deepVal = { child: deepVal };
    }
    expect(() => validate(shallowForm, deepVal)).toThrowError(
      expect.objectContaining({ code: "too_deep" }),
    );
  });
});

describe("Additional unit tests for validation & rendering", () => {
  it("handles multipleOf with binary float tolerance", () => {
    const form = compileForm({
      type: "object",
      properties: {
        val: { type: "number", multipleOf: 0.0001 },
      },
    });
    expect(validate(form, { val: 0.0075 })).toEqual([]);
    expect(validate(form, { val: 0.00751 })).toHaveLength(1);
  });

  it("handles exclusiveMinimum and exclusiveMaximum", () => {
    const form = compileForm({
      type: "object",
      properties: {
        num: { type: "number", exclusiveMinimum: 10, exclusiveMaximum: 20 },
      },
    });
    expect(validate(form, { num: 10 })).toHaveLength(1);
    expect(validate(form, { num: 11 })).toEqual([]);
    expect(validate(form, { num: 20 })).toHaveLength(1);
  });

  it("handles additionalProperties false and minItems/maxItems", () => {
    const form = compileForm({
      type: "object",
      properties: {
        arr: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 2 },
      },
      additionalProperties: false,
    });
    expect(validate(form, { arr: [] })).toEqual([
      { path: "/arr", code: "minItems", message: "minItems failed" },
    ]);
    expect(validate(form, { arr: ["a", "b", "c"] })).toEqual([
      { path: "/arr", code: "maxItems", message: "maxItems failed" },
    ]);
    expect(validate(form, { arr: ["a"], extra: 123 })).toEqual([
      { path: "/extra", code: "additionalProperties", message: "additionalProperties failed" },
    ]);
  });

  it("renders hint with aria-describedby", () => {
    const form = compileForm({
      type: "object",
      properties: {
        user: { type: "string", title: "Username", description: "Your login handle" },
      },
    });
    const html = renderHtml(form);
    expect(html).toContain('<p id="jsf-0-hint" class="jsf-hint">Your login handle</p>');
    expect(html).toContain('aria-describedby="jsf-0-hint"');
  });

  it("rejects non-object schema with FormError invalid_schema", () => {
    expect(() => compileForm(null as unknown as object)).toThrowError(FormError);
    expect(() => compileForm("string" as unknown as object)).toThrowError(FormError);
  });

  it("handles const and enum with objects and arrays in validation", () => {
    const form = compileForm({
      type: "object",
      properties: {
        objConst: { const: { a: 1, b: [2, 3] } },
        arrEnum: {
          enum: [
            [1, 2],
            [3, 4],
          ],
        },
      },
    });
    expect(validate(form, { objConst: { a: 1, b: [2, 3] }, arrEnum: [1, 2] })).toEqual([]);
    expect(validate(form, { objConst: { a: 1, b: [2, 4] } })).toHaveLength(1);
    expect(validate(form, { objConst: { a: 1 } })).toHaveLength(1);
    expect(validate(form, { objConst: [1, 2] })).toHaveLength(1);
    expect(validate(form, { arrEnum: [1, 3] })).toHaveLength(1);
    expect(validate(form, { arrEnum: "not-array" })).toHaveLength(1);
  });

  it("handles allOf and else required rendering", () => {
    const form = compileForm({
      type: "object",
      allOf: [
        {
          properties: {
            shared: { type: "string" },
          },
        },
      ],
      if: {
        properties: { cond: { const: "A" } },
      },
      // biome-ignore lint/suspicious/noThenProperty: JSON Schema keyword 'then'
      then: {
        properties: { thenField: { type: "string" } },
        required: ["thenField"],
      },
      else: {
        properties: { elseField: { type: "string" } },
        required: ["elseField"],
      },
    });

    const htmlThen = renderHtml(form, { value: { cond: "A" } });
    expect(htmlThen).toContain('name="thenField" type="text" required');

    const htmlElse = renderHtml(form, { value: { cond: "B" } });
    expect(htmlElse).toContain('name="elseField" type="text" required');
  });

  it("validates array of types, null, and boolean types", () => {
    const form = compileForm({
      type: "object",
      properties: {
        multi: { type: ["string", "null", "boolean"] },
      },
    });
    expect(validate(form, { multi: "hello" })).toEqual([]);
    expect(validate(form, { multi: null })).toEqual([]);
    expect(validate(form, { multi: true })).toEqual([]);
    expect(validate(form, { multi: 123 })).toHaveLength(1);
  });
});
