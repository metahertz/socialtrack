# SocialTrack

A social media performance dashboard that visualizes follower growth and cumulative impressions across **LinkedIn**, **Twitter (X)**, and **YouTube**—with a dark, modern chart style.

## Features

- **Dual-axis chart**: Cumulative impressions (left) and followers (right) over time
- **Post markers**: Diamond markers on the chart indicate when content was published
- **Summary stats**: Total impressions, follower range (start → end), and growth
- **Platform filter**: Toggle LinkedIn, Twitter, and YouTube to view combined or per-platform data
- **Dark theme**: Green accents on dark background, matching the reference design

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Data Sources

The app currently uses **sample data** for demonstration. To connect real data:

### Option 1: API integrations (future)

- **LinkedIn**: [Marketing API](https://docs.microsoft.com/en-us/linkedin/marketing/) for impressions and follower metrics
- **Twitter (X)**: [Engagement Analytics API](https://developer.x.com/en/docs/twitter-api/analytics/engagement-analytics) (requires elevated access)
- **YouTube**: [Data API v3](https://developers.google.com/youtube/v3) for views and subscriber counts

### Option 2: CSV / JSON import

You can extend the app to accept CSV or JSON uploads. The data shape is:

```ts
interface DailyMetrics {
  date: string;        // YYYY-MM-DD
  impressions: number;
  followers: number;
  postPublished?: boolean;
}
```

## Project Structure

```
src/
├── app/           # Next.js app router (page, layout)
├── components/    # SocialPerformanceChart
├── data/          # Sample data
├── lib/           # Aggregation utilities
└── types/         # TypeScript types
```

## Tech Stack

- **Next.js 14** (App Router)
- **React 18**
- **Recharts** (dual-axis line chart)
- **Tailwind CSS** (styling)
- **TypeScript**
