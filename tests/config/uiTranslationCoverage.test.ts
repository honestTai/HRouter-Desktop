import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import zh from "@/i18n/locales/zh.json";
import tw from "@/i18n/locales/zh-TW.json";
import en from "@/i18n/locales/en.json";
import ja from "@/i18n/locales/ja.json";
function sources(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? sources(path.join(dir, e.name))
        : e.name.endsWith(".tsx") && !e.name.endsWith(".test.tsx")
          ? [path.join(dir, e.name)]
          : [],
    );
}
function has(root: unknown, key: string) {
  return (
    key
      .split(".")
      .reduce<any>(
        (node, k) => (node && typeof node === "object" ? node[k] : undefined),
        root,
      ) !== undefined
  );
}
describe("UI translations", () => {
  const keys = new Set(
    sources(path.resolve("src")).flatMap((file) =>
      [
        ...fs.readFileSync(file, "utf8").matchAll(/\bt\(\s*["']([^"']+)["']/g),
      ].map((m) => m[1]),
    ),
  );
  for (const [lang, locale] of Object.entries({ zh, tw, en, ja }))
    it(`resolves static React UI keys in ${lang}`, () => {
      expect(
        [...keys].filter(
          (key) => !has(locale, key) && !has(locale, key + "_other"),
        ),
      ).toEqual([]);
    });
});
