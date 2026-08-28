export const HROUTER_ANNOUNCEMENTS_URL =
  "https://hrouter.net/api/v1/announcements";

export interface HRouterAnnouncement {
  id: string;
  title: string;
  content: string;
  category?: string;
  publishedAt?: string;
  isRead: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function identifier(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function unwrapAnnouncementList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  const root = asRecord(payload);
  if (!root) return [];
  if (Array.isArray(root.announcements)) return root.announcements;
  if (Array.isArray(root.items)) return root.items;

  const data = root.data;
  if (Array.isArray(data)) return data;
  const dataRecord = asRecord(data);
  if (!dataRecord) return [];
  if (Array.isArray(dataRecord.announcements)) {
    return dataRecord.announcements;
  }
  return Array.isArray(dataRecord.items) ? dataRecord.items : [];
}

export function parseHRouterAnnouncements(
  payload: unknown,
): HRouterAnnouncement[] {
  return unwrapAnnouncementList(payload)
    .map<HRouterAnnouncement | null>((item, index) => {
      const record = asRecord(item);
      if (!record) return null;

      const title = firstString(record.title, record.name, record.subject);
      const content = firstString(
        record.content,
        record.body,
        record.message,
        record.description,
      );
      if (!title && !content) return null;

      const id = identifier(record.id ?? record.uuid, `announcement-${index}`);
      return {
        id,
        title: title ?? "HRouter 公告",
        content: content ?? "",
        category: firstString(record.category, record.type, record.level),
        publishedAt: firstString(
          record.published_at,
          record.created_at,
          record.updated_at,
          record.date,
        ),
        isRead: Boolean(record.read_at ?? record.is_read ?? record.read),
      } satisfies HRouterAnnouncement;
    })
    .filter((item): item is HRouterAnnouncement => item !== null);
}
