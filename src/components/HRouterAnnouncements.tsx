import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Bell, Loader2, RefreshCw, Radio } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { fetchHRouterAnnouncements } from "@/lib/api/hrouterAnnouncements";
import { HROUTER_ANNOUNCEMENTS_URL } from "@/lib/hrouterAnnouncements";

function formatAnnouncementDate(value: string | undefined, locale: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function plainAnnouncementContent(content: string) {
  if (!content.includes("<")) return content;
  const document = new DOMParser().parseFromString(content, "text/html");
  return document.body.textContent?.trim() ?? content;
}

export function HRouterAnnouncements() {
  const { t, i18n } = useTranslation();
  const query = useQuery({
    queryKey: ["hrouter-announcements"],
    queryFn: fetchHRouterAnnouncements,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const announcements = useMemo(
    () =>
      [...(query.data ?? [])].sort((left, right) =>
        (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""),
      ),
    [query.data],
  );

  return (
    <div className="h-full overflow-y-auto bg-muted/20 px-6 py-5">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-border-default pb-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Bell className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold">
                {t("hrouterAnnouncements.title", {
                  defaultValue: "HRouter 公告",
                })}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("hrouterAnnouncements.description", {
                  defaultValue: "直接同步 HRouter.net 平台公告",
                })}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
            className="h-8 gap-2"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`}
            />
            {t("common.refresh", { defaultValue: "刷新" })}
          </Button>
        </div>

        {query.isLoading ? (
          <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("hrouterAnnouncements.loading", {
              defaultValue: "正在同步公告...",
            })}
          </div>
        ) : query.isError ? (
          <div className="border border-amber-500/30 bg-amber-500/5 px-5 py-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {t("hrouterAnnouncements.unavailableTitle", {
                    defaultValue: "公告接口暂不可用",
                  })}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {t("hrouterAnnouncements.unavailableDescription", {
                    defaultValue:
                      "HRouter.net 公告接口尚未开放或当前网络不可用。接口开放后，此处会自动显示公告。",
                  })}
                </p>
                <code className="mt-3 block overflow-x-auto text-xs text-muted-foreground">
                  GET {HROUTER_ANNOUNCEMENTS_URL}
                </code>
              </div>
            </div>
          </div>
        ) : announcements.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center border border-dashed border-border-default text-center">
            <Radio className="mb-3 h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium">
              {t("hrouterAnnouncements.emptyTitle", {
                defaultValue: "暂无公告",
              })}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("hrouterAnnouncements.emptyDescription", {
                defaultValue: "HRouter.net 发布新公告后会显示在这里。",
              })}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border-default border-y border-border-default bg-background">
            {announcements.map((announcement) => (
              <article key={announcement.id} className="px-1 py-5 sm:px-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold">
                    {announcement.title}
                  </h3>
                  {announcement.category && (
                    <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {announcement.category}
                    </span>
                  )}
                  {announcement.publishedAt && (
                    <time className="ml-auto text-xs text-muted-foreground">
                      {formatAnnouncementDate(
                        announcement.publishedAt,
                        i18n.language,
                      )}
                    </time>
                  )}
                </div>
                {announcement.content && (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {plainAnnouncementContent(announcement.content)}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
