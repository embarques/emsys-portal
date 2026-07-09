# Quick Actions Ranking — Technical Spec

Tracks per-user usage of search "Quick Actions" and surfaces the most relevant ones at the top of the search dropdown.

---

## 1. Data Model

### Table: `user_action_usage`

One row per (user, action) pair. Upserted on every use — not a raw event log.

| Column         | Type      | Notes                                              |
|----------------|-----------|-----------------------------------------------------|
| `id`           | uuid/pk   | primary key                                        |
| `user_id`      | fk        | references `users.id`                              |
| `action_id`    | string    | e.g. `find_customer`, `create_customer`, `inventory_lookup`, `monthly_reports` |
| `count`        | integer   | total times used, default 0                        |
| `last_used_at` | timestamp | updated on every use                                |
| `created_at`   | timestamp | first time this action was ever used by this user   |

**Indexes:** unique index on `(user_id, action_id)`, plus an index on `(user_id, last_used_at)` for recency queries.

### Reference table: `actions` (static/config, not user-specific)

| Column      | Type   | Notes                                  |
|-------------|--------|-----------------------------------------|
| `action_id` | string | primary key, matches above              |
| `label`     | string | "Find customer"                         |
| `subtitle`  | string | "Search customer records"               |
| `icon`      | string | icon identifier                         |
| `route`     | string | frontend route/path to navigate to      |
| `is_active` | bool   | allows disabling an action without deleting usage history |

Keeping action metadata separate from usage means you can add/remove/rename actions without touching usage rows, and you can compute a **global fallback ranking** by aggregating `user_action_usage` across all users for cold-start users.

---

## 2. Endpoints

### `POST /api/actions/track`
Fire-and-forget on click. Does not block navigation.

**Request payload:**
```json
{
  "action_id": "inventory_lookup"
}
```
`user_id` comes from the auth session, not the payload.

**Response payload:**
```json
{
  "success": true
}
```
- Status `204 No Content` is also fine here since the frontend doesn't need to do anything with the response.
- No need to await this before navigating the user to the action's route.

---

### `GET /api/actions/top?limit=4`

**Query params:**
| Param   | Type | Default | Notes                        |
|---------|------|---------|-------------------------------|
| `limit` | int  | 4       | number of actions to return   |

**Response payload:**
```json
{
  "actions": [
    {
      "action_id": "monthly_reports",
      "label": "Monthly reports",
      "subtitle": "Open operations reports",
      "icon": "file-text",
      "route": "/reports/monthly",
      "score": 8.42
    },
    {
      "action_id": "find_customer",
      "label": "Find customer",
      "subtitle": "Search customer records",
      "icon": "users",
      "route": "/customers/search",
      "score": 6.10
    }
  ],
  "source": "personalized"
}
```
- `source` is either `"personalized"` (user has usage history) or `"default"` (cold start, showing global/fallback ranking) — useful for frontend analytics or subtly different UI treatment if you want.
- `score` is optional in the payload; include it only if useful for debugging/frontend logic. Otherwise the array order alone conveys ranking.

---

## 3. Ranking Logic

**Goal:** balance frequency with recency, so an action used heavily last year doesn't permanently outrank one used daily this week.

### Formula (exponential recency decay)

```
score = count * exp(-days_since_last_used / half_life)
```

- `half_life` — tunable constant, e.g. `14` days. A 14-day half-life means an action's weight halves roughly every two weeks of disuse.
- Compute this at query time, not stored — keeps the stored data simple (just `count` and `last_used_at`).

### Query (Postgres example)

```sql
SELECT
  action_id,
  count,
  count * exp(-EXTRACT(EPOCH FROM (now() - last_used_at)) / 86400.0 / 14.0) AS score
FROM user_action_usage
WHERE user_id = $1
ORDER BY score DESC
LIMIT $2;
```

### Cold start fallback

If the user has fewer than `N` tracked actions (e.g. `< limit`), backfill remaining slots with either:
1. A hardcoded default order (what's currently shown), or
2. A global popularity ranking — same query as above but aggregated across all users, recomputed periodically (e.g. materialized view refreshed hourly/daily) rather than live.

```sql
-- Global fallback, precomputed and cached
SELECT action_id, SUM(count) AS total_count
FROM user_action_usage
GROUP BY action_id
ORDER BY total_count DESC
LIMIT 4;
```

### Edge cases
- **Tie-breaking:** if scores are equal (e.g. both zero for cold-start users), fall back to a fixed default order defined in the `actions` config.
- **New actions:** an action with no usage rows simply won't appear until first used — always merge personalized results with the default list so nothing gets permanently hidden.
- **Decayed to near-zero:** actions with `score < some threshold` (e.g. `0.01`) can be treated as "unused" and excluded, so ancient one-off clicks don't linger.

---

## 4. Frontend Flow Summary

1. On search bar open → `GET /api/actions/top?limit=4` (cache client-side per session, refresh every few minutes or on new session).
2. On quick action click → fire `POST /api/actions/track` (don't await), then navigate.
3. Merge personalized results with static fallback list if `source: "default"` or fewer than `limit` items returned.
