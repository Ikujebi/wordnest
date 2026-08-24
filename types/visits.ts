// types/visits.ts
import { IsString, IsOptional } from 'class-validator';

export class TrackAnalyticsEventDto {
  @IsString()
  visitorId!: string;

  @IsString()
  sessionId!: string;

  @IsString()
  event!: string;

  @IsOptional() @IsString()
  path?: string;

  @IsOptional() @IsString()
  title?: string;

  @IsOptional() @IsString()
  url?: string;

  @IsOptional() @IsString()
  referrer?: string;

  @IsOptional() @IsString()
  device?: string;

  @IsOptional() @IsString()
  browser?: string;

  @IsOptional() @IsString()
  os?: string;

  @IsOptional() @IsString()
  country?: string;

  @IsOptional() @IsString()
  city?: string;
}

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