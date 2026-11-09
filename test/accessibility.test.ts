import axe from "axe-core";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { compileForm, renderHtml } from "../src/index.js";

describe("Accessibility (WCAG 2.1 AA) with axe-core in jsdom", () => {
  it("has zero axe violations for standard form controls", async () => {
    const schema = {
      type: "object",
      properties: {
        fullName: {
          type: "string",
          title: "Full Name",
          description: "Your legal name",
          minLength: 2,
        },
        role: {
          type: "string",
          title: "Role",
          enum: ["Admin", "Editor", "Viewer"],
        },
        terms: {
          type: "boolean",
          title: "I accept the terms",
        },
      },
      required: ["fullName", "terms"],
    };

    const form = compileForm(schema);
    const fragmentHtml = renderHtml(form);

    // Wrap in accessible document structure
    const fullHtml = `<!DOCTYPE html><html lang="en"><head><title>Form Test</title></head><body><main><form>${fragmentHtml}</form></main></body></html>`;
    const dom = new JSDOM(fullHtml, { runScripts: "dangerously" });

    const results = await axe.run(dom.window.document.documentElement, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa"],
      },
    });

    expect(results.violations).toEqual([]);
  });
});
