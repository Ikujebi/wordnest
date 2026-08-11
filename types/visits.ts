
export interface UmamiStatsComparison {
  pageviews: number;
  visitors: number;
  visits: number;
  bounces: number;
  totaltime: number;
}

export interface UmamiStatsResponse {
  pageviews: number;
  visitors: number;
  visits: number;
  bounces: number;
  totaltime: number;
  comparison?: UmamiStatsComparison;
}

export interface AnalyticsResult {
  newVisitors: number;
  returningVisits: number;
  totalVisitors: number;
  totalVisits: number;
  totalPageviews: number;
  visitorsChangePercent: number | null;
  periodDays: number;
  source: 'database' | 'umami';
}
