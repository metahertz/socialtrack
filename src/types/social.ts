export type Platform = "linkedin" | "twitter" | "youtube";

export interface PostOnDate {
  content: string;
  impressions: number;
}

export interface DailyMetrics {
  date: string; // YYYY-MM-DD
  impressions: number;
  followers: number;
  postPublished?: boolean;
  postsOnDate?: PostOnDate[];
}

export interface PlatformMetrics {
  platform: Platform;
  displayName: string;
  dailyData: DailyMetrics[];
}

export interface AggregatedMetrics {
  date: string;
  cumulativeImpressions: number;
  followers: number;
  postPublished: boolean;
  postsOnDate?: PostOnDate[];
}
