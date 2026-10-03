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
  "quickKeyTitle",
  "quickKeyDescription",
  "providersTitle",
  "providersDescription",
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
