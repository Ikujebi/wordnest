export interface AnalyticsResult {
  newVisitors: number;
  returningVisitors: number;
  totalVisitors: number;
  totalVisits: number;
  totalPageviews: number;
  visitorsChangePercent: number | null;
  periodDays: number;
  source: 'database';
}

export interface TrackAnalyticsEventDto {
  visitorId: string;
  sessionId: string;

  event: string;

  path?: string;
  title?: string;
  url?: string;

  referrer?: string;

  device?: string;
  browser?: string;
  os?: string;

  country?: string;
  city?: string;
}