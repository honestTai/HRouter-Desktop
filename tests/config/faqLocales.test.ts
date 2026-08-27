import { describe, expect, it } from "vitest";
import en from "@/i18n/locales/en.json";
import ja from "@/i18n/locales/ja.json";
import zhTW from "@/i18n/locales/zh-TW.json";
import zh from "@/i18n/locales/zh.json";

const requiredKeys = [
  "button",
  "title",
  "description",
  "firstVisitBadge",
  "quickStart",
  "step1Title",
  "step1Description",
  "step2Title",
  "step2Description",
  "step3Title",
  "step3Description",
  "featureOverview",
  "portalTitle",
  "portalDescription",
  "providersTitle",
  "providersDescription",
  "modelPlazaTitle",
  "modelPlazaDescription",
  "contextTitle",
  "contextDescription",
  "usageTitle",
  "usageDescription",
  "agentsTitle",
  "agentsDescription",
  "updatesTitle",
  "updatesDescription",
  "supportTitle",
  "supportDescription",
  "copyGroup",
  "groupCopied",
  "groupCopyFailed",
  "footerHint",
  "start",
] as const;

const locales = [
  ["en", en.faq],
  ["ja", ja.faq],
  ["zh", zh.faq],
  ["zh-TW", zhTW.faq],
] as const;

function interpolationVariables(value: string): string[] {
  return Array.from(
    value.matchAll(/\{\{([^}]+)\}\}/g),
    ([, name]) => name,
  ).sort();
}

describe("FAQ locale coverage", () => {
  it.each(locales)("defines every FAQ key in %s", (_locale, faq) => {
    const missing = requiredKeys.filter((key) => {
      const value = faq[key];
      return typeof value !== "string" || value.trim().length === 0;
    });

    expect(missing).toEqual([]);
  });

  it.each(locales.slice(1))(
    "preserves FAQ interpolation variables in %s",
    (_locale, faq) => {
      for (const key of requiredKeys) {
        expect(interpolationVariables(faq[key])).toEqual(
          interpolationVariables(en.faq[key]),
        );
      }
    },
  );
});

const portalKeys = [
  "title",
  "open",
  "entry",
  "home",
  "refresh",
  "openExternal",
  "loading",
] as const;

describe("HRouter portal locale coverage", () => {
  it.each([
    ["en", en.hrouterWeb],
    ["ja", ja.hrouterWeb],
    ["zh", zh.hrouterWeb],
    ["zh-TW", zhTW.hrouterWeb],
  ] as const)("defines every portal key in %s", (_locale, portal) => {
    expect(
      portalKeys.filter(
        (key) => !portal[key] || portal[key].trim().length === 0,
      ),
    ).toEqual([]);
  });
});
