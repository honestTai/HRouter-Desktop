import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory()
      ? sourceFiles(file)
      : file.endsWith(".tsx") && !file.endsWith(".test.tsx")
        ? [file]
        : [];
  });
}

describe("shared React UI boundaries", () => {
  it("keeps native interactive controls inside UI primitives only", () => {
    const violations: string[] = [];
    const banned = new Set([
      "button",
      "input",
      "select",
      "textarea",
      "table",
      "details",
      "summary",
      "dialog",
    ]);
    for (const file of sourceFiles(path.resolve("src"))) {
      if (file.includes(`${path.sep}components${path.sep}ui${path.sep}`))
        continue;
      const source = ts.createSourceFile(
        file,
        fs.readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      const visit = (node: ts.Node) => {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
          const tag = node.tagName.getText(source);
          const type = node.attributes.properties.find(
            (attr): attr is ts.JsxAttribute =>
              ts.isJsxAttribute(attr) && attr.name.getText(source) === "type",
          );
          const inputType =
            type?.initializer && ts.isStringLiteral(type.initializer)
              ? type.initializer.text
              : undefined;
          // Hidden fields are DOM serialization, not interactive controls.
          const hidden = tag === "input" && inputType === "hidden";
          if (
            (banned.has(tag) && !hidden) ||
            (tag === "Input" &&
              ["checkbox", "radio", "date", "time", "datetime-local"].includes(
                inputType ?? "",
              ))
          ) {
            violations.push(
              `${path.relative(process.cwd(), file)}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1} <${tag} type=${inputType}>`,
            );
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    expect(violations).toEqual([]);
  });

  it("keeps the wallet aligned with current sub2api and prevents horizontal amount-card overflow", () => {
    const page = fs.readFileSync(
      path.resolve("src/components/hrouter/HRouterBillingPage.tsx"),
      "utf8",
    );
    for (const obsolete of [
      "estimateRecharge",
      "CACHE_SHARE",
      "referenceModel",
      "tokenEstimate",
      "officialValueEstimate",
    ])
      expect(page).not.toContain(obsolete);
    expect(page).toContain("flex-col gap-1 whitespace-normal");
    expect(page).toContain("aria-pressed={numericAmount === value}");
    expect(page).toContain('t("hrouterWallet.summary")');
  });

  it("removes prompt management routes and a duplicate dashboard destination", () => {
    const app = fs.readFileSync(path.resolve("src/App.tsx"), "utf8");
    const nav = fs.readFileSync(
      path.resolve("src/components/layout/MagpieTopNav.tsx"),
      "utf8",
    );
    expect(app).not.toContain('case "prompts"');
    expect(app).not.toContain("<PromptPanel");
    expect(nav).not.toContain('onNavigate("prompts")');
    expect(nav).not.toContain('onNavigate("dashboard")');
    expect(nav.match(/onNavigate\("usage"\)/g)).toHaveLength(1);
    expect(app).toContain(
      'if ((saved as string) === "dashboard") return "usage"',
    );
  });
});
