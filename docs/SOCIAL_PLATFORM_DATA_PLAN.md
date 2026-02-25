# SocialTrack: Plan to Pull Data from Social Platforms

This document outlines the strategy for integrating live data from LinkedIn, Twitter (X), and YouTube into SocialTrack.

---

## Current State

- **Data model**: `PlatformMetrics` with `dailyData` (date, impressions, followers, postPublished)
- **Platforms**: LinkedIn, Twitter (X), YouTube
- **Display**: Aggregated follower growth + cumulative impressions chart

---

## 1. LinkedIn

### API Overview

- **Product**: LinkedIn Marketing API (REST)
- **Docs**: [Microsoft Learn - LinkedIn Marketing](https://learn.microsoft.com/en-us/linkedin/marketing/)

### Metrics Available

| Metric | API | Endpoint | Notes |
|--------|-----|----------|-------|
| **Followers (daily)** | `memberFollowersCount` | `GET /rest/memberFollowersCount?q=dateRange` | Time-bound daily follower counts |
| **Followers (lifetime)** | `memberFollowersCount` | `GET /rest/memberFollowersCount?q=me` | Current total |
| **Post impressions** | `memberCreatorPostAnalytics` | Post-level analytics | IMPRESSION, MEMBERS_REACHED, REACTION, COMMENT, RESHARE |

### Auth & Access

- **Auth**: OAuth 2.0
- **Permissions**: `r_member_profileAnalytics`, `r_member_postAnalytics`
- **App setup**: [LinkedIn Developer Portal](https://www.linkedin.com/developers/) → Create app → Request Marketing API access

### Implementation Steps

1. **OAuth flow**: Implement LinkedIn OAuth 2.0 (authorization code) for user consent
2. **Store tokens**: Securely store access + refresh tokens (e.g., encrypted DB, env for server-side)
3. **Follower stats**: Call `memberFollowersCount` with `dateRange` for daily follower counts over a period
4. **Post analytics**: Call `memberCreatorPostAnalytics` for post-level impressions; aggregate to daily totals
5. **Map to `DailyMetrics`**: Combine followers + impressions per date; set `postPublished` from post creation dates

### Limitations

- API access requires LinkedIn Marketing Developer Platform approval
- Post analytics may have a delay (typically 24–48 hours)
- Rate limits apply; implement backoff and caching

---

## 2. Twitter (X)

### API Overview

- **Product**: X API v2 (Enterprise / paid tier for analytics)
- **Docs**: [X Developer Platform](https://developer.x.com/)

### Metrics Available

| Metric | API | Endpoint | Notes |
|--------|-----|----------|-------|
| **Impressions** | Post analytics | `GET /2/tweets/analytics` | Per-post, granularity: hourly/daily/weekly/total |
| **Followers** | Users API | `GET /2/users/:id` (public_metrics) | Follower count in user object |
| **Engagements** | Post analytics | Same endpoint | likes, retweets, replies, etc. |

### Auth & Access

- **Auth**: OAuth 2.0 User Context (user must authorize app)
- **Pricing**: Post analytics is **pay-per-use** (~$0.005/request); requires X API credits
- **App setup**: [X Developer Console](https://developer.x.com/) → Create project → Enable analytics

### Implementation Steps

1. **OAuth 2.0 PKCE**: Implement X OAuth flow for user authorization
2. **User lookup**: `GET /2/users/me` to get user ID and `public_metrics.followers_count`
3. **Post analytics**: `GET /2/tweets/analytics` with `ids`, `start_time`, `end_time`, `granularity=daily`
4. **Historical followers**: X does not provide historical follower counts via API. Options:
   - Store daily snapshots when you fetch (recommended)
   - Use a third-party service (e.g., Social Blade) for historical data
5. **Map to `DailyMetrics`**: Sum impressions from post analytics per day; use stored follower snapshots for `followers`; infer `postPublished` from post creation timestamps

### Limitations

- **Post analytics**: Only available for posts from last 30 days (check current docs)
- **Cost**: Pay-per-request; batch and cache to control spend
- **Historical followers**: Must be built via daily snapshots

---

## 3. YouTube

### API Overview

- **Products**: YouTube Data API v3 + YouTube Analytics API
- **Docs**: [YouTube Analytics API](https://developers.google.com/youtube/analytics)

### Metrics Available

| Metric | API | Notes |
|--------|-----|-------|
| **Subscribers** | YouTube Analytics API | Channel-level, dimension: `day` |
| **Views** | YouTube Analytics API | Use as proxy for “impressions” |
| **Watch time** | YouTube Analytics API | Optional engagement metric |

### Auth & Access

- **Auth**: Google OAuth 2.0
- **Scopes**: `https://www.googleapis.com/auth/youtube.readonly`, `https://www.googleapis.com/auth/yt-analytics.readonly`
- **App setup**: [Google Cloud Console](https://console.cloud.google.com/) → Enable YouTube Data API v3 + YouTube Analytics API

### Implementation Steps

1. **OAuth 2.0**: Implement Google OAuth for channel owner
2. **Channel ID**: Use YouTube Data API `channels.list` with `mine=true` to get channel ID
3. **Analytics query**: YouTube Analytics API `reports.query` with:
   - `ids=channel==CHANNEL_ID`
   - `dimensions=day`
   - `metrics=views,subscribersGained` (or similar; check [metrics reference](https://developers.google.com/youtube/analytics/v1/dimsmets/mets))
4. **Map to `DailyMetrics`**: `views` → impressions; `subscribersGained` + cumulative logic → followers; `postPublished` from video upload dates (YouTube Data API)

### Limitations

- Analytics data can have 24–48 hour delay
- Only channel owners (or authorized users) can access analytics
- Quota limits; use batching and caching

---

## 4. Architecture Recommendations

### Data Flow

```
[User OAuth] → [Token Storage] → [API Routes / Server Actions]
                                        ↓
                              [Platform-specific fetchers]
                                        ↓
                              [Normalize to PlatformMetrics]
                                        ↓
                              [Cache / DB] → [Chart]
```

### Suggested Structure

```
src/
├── lib/
│   ├── platforms/
│   │   ├── linkedin.ts    # LinkedIn API client
│   │   ├── twitter.ts     # X API client
│   │   └── youtube.ts     # YouTube API client
│   └── normalize.ts       # Map API responses → PlatformMetrics
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── linkedin/route.ts
│   │   │   ├── twitter/route.ts
│   │   │   └── youtube/route.ts
│   │   └── data/
│   │       └── metrics/route.ts   # Fetch + aggregate metrics
│   └── ...
```

### Caching Strategy

- **Cache duration**: 24 hours for analytics (align with platform delays)
- **Storage**: Redis or DB table with `platform`, `date`, `metrics`
- **Fallback**: Use sample data when no live data or tokens

### Security

- Store OAuth tokens encrypted (e.g., AES-256)
- Use environment variables for client IDs/secrets
- Validate and sanitize all API responses
- Implement token refresh and handle expiry

---

## 5. Implementation Phases

| Phase | Scope | Effort |
|-------|--------|--------|
| **1** | OAuth + token storage for one platform (e.g., LinkedIn) | 1–2 days |
| **2** | LinkedIn fetcher + normalize → `PlatformMetrics` | 1 day |
| **3** | API route to serve live LinkedIn data; wire to chart | 0.5 day |
| **4** | Repeat for Twitter (X) | 1–2 days |
| **5** | Repeat for YouTube | 1–2 days |
| **6** | Caching, error handling, fallback to sample data | 1 day |
| **7** | UI for connecting/disconnecting accounts | 1 day |

**Total estimate**: ~7–10 days

---

## 6. Environment Variables

```env
# LinkedIn
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_REDIRECT_URI=

# X (Twitter)
X_CLIENT_ID=
X_CLIENT_SECRET=
X_REDIRECT_URI=

# YouTube (Google)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# Optional: Encryption key for tokens
TOKEN_ENCRYPTION_KEY=
```

---

## 7. References

- [LinkedIn Marketing API - Follower Statistics](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/members/follower-statistics)
- [LinkedIn Marketing API - Post Statistics](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/members/post-statistics)
- [X API - Get Post Analytics](https://docs.x.com/x-api/posts/get-engagement-analytics)
- [X API - Metrics](https://developer.x.com/en/docs/twitter-api/metrics)
- [YouTube Analytics API](https://developers.google.com/youtube/analytics)
- [YouTube Analytics - Channel Reports](https://developers.google.com/youtube/analytics/v1/channel_reports)
