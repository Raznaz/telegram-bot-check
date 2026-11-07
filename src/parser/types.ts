export type OutageStatus = "active" | "restored";

export interface Outage {
  id: string; // WordPress post id
  url: string;
  title: string;
  publishedAt: Date;
  status: OutageStatus; // "restored" если в заголовке (відновлено)/(виконано)
  body: string; // plain text
}
