# Phase 3 — Weight tracking (backend vertical slice)

This document specifies the API contract and validation rules for the weight tracking feature.

## Frontend behavior (Phase 3)

### Screen structure

Route: `/weight`

- Sticky primary action: **Add weigh-in** (floating button)
- **Trend summary** card
  - 7-day average
  - 14-day average
  - Change vs last week
- **Chart** card
  - Range toggle: `7d / 30d / 90d`
  - Shows raw points + moving average line
- **History** table
  - Inline edit: date/time + weight
  - Delete with **Undo** toast (true undo: deferred server delete; Undo cancels delete)

### Formulas

All computations use the list returned by `GET /weights`.

- **7-day average** / **14-day average**
  - Filter entries within an **inclusive** window of `N` days ending at “now”:
    - `start = (end - (N - 1) days).startOfDay`
    - include points where `start <= datetime <= end.endOfDay`
  - Average = arithmetic mean of the weights in that window.

- **Change vs last week**
  - `delta = avg_7d(end) - avg_7d(end - 7 days)`

- **Moving average (chart)**
  - Trailing moving average over the last **7 points** (not time-bucketed).
  - For each point index `i`:
    - `ma[i] = mean(weight[max(0, i-6) .. i])`

### Modal: Add weigh-in

Fields:
- `weight_kg` (required)
- `datetime` (required)
- `note` (optional, max 500)

Validation UX:
- Friendly client-side validation for weight range `20..500`.
- Accepts comma or dot as decimal separator.

Quick actions:
- **Today** sets datetime to now.
- **Yesterday** sets datetime to now minus 1 day.

### Auth (dev)

For development convenience, the Weight screen shows a minimal login form when `GET /weights` returns `401`.
On successful login, the access token is stored in `localStorage` and attached as:
`Authorization: Bearer <access_token>`.

## Auth

All endpoints in this document require a valid **access** JWT.

- Header: `Authorization: Bearer <access_token>`
- On missing/invalid/expired token: `401`.

## Data model

Table: `weight_entries`

- `id` (uuid)
- `user_id` (uuid, FK -> users.id, cascade delete)
- `datetime_utc` (timestamp with timezone) — stored normalized to UTC
- `weight_kg` (numeric(5,2))
- `note` (string, max 500, nullable)
- `created_at`, `updated_at` (timestamp with timezone)

## Validation rules

### weight_kg

- Must be within a “sane” range:
  - min: **20.0 kg**
  - max: **500.0 kg**
- Values outside the range return `422` (Pydantic validation error).

### datetime normalization

All datetimes are normalized to **timezone-aware UTC**.

- If the client sends a timezone-aware datetime, it is converted to UTC.
- If the client sends a naive datetime (no timezone), it is treated as UTC.

This applies to:
- Request body field `datetime` for create/update
- Query params `from` / `to` for listing

## Endpoints

### POST `/weights`

Create a weigh-in entry for the current user.

Request body:

```json
{
  "datetime": "2026-02-16T10:00:00+01:00",
  "weight_kg": 80.5,
  "note": "optional"
}
```

Responses:

- `201`:

```json
{
  "id": "<uuid>",
  "datetime": "2026-02-16T09:00:00+00:00",
  "weight_kg": 80.5,
  "note": "optional"
}
```

- `401` if not authenticated
- `422` if validation fails

### GET `/weights?from=&to=`

List weigh-ins for the current user.

Query params:
- `from` (optional datetime)
- `to` (optional datetime)

Returned list is ordered by `datetime` ascending.

Response `200`:

```json
{
  "items": [
    {
      "id": "<uuid>",
      "datetime": "2026-02-16T09:00:00+00:00",
      "weight_kg": 80.5,
      "note": null
    }
  ]
}
```

### PATCH `/weights/{id}`

Update a weigh-in entry belonging to the current user.

Request body (all optional):

```json
{
  "datetime": "2026-02-16T10:00:00Z",
  "weight_kg": 81.25,
  "note": "after training"
}
```

PATCH semantics for `note`:
- If `note` is **omitted**: keep existing value.
- If `note` is **null**: clear the note.
- If `note` is a **string**: set/update the note.

Responses:
- `200` updated entry
- `401` if not authenticated
- `404` if entry does not exist for the current user
- `422` if validation fails

### DELETE `/weights/{id}`

Delete a weigh-in entry belonging to the current user.

Responses:
- `204` on success
- `401` if not authenticated
- `404` if entry does not exist for the current user
