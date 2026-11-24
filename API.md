# CheeseFork² API

The API lets scripts and other apps view and change your saved schedule: add and remove
courses, choose lessons, set colors and manage custom events. Changes show up immediately
in any open CheeseFork² tab.

## API keys

Each signed-in user can have one personal API key. Sign in on the site, then click **API**
in the navigation bar to create, replace or revoke it. The key is shown only once, when it's
created. CheeseFork² stores only its hash, so a lost key can't be recovered: replace it.

Anyone with your key can change your schedule. Keep it secret, and revoke it if it leaks.

Send the key with every request:

```
Authorization: Bearer cf2_...
```

`X-API-Key: cf2_...` works as well.

## Basics

Base URL: `https://api.cf.talisrae.li/v1`

- Request and response bodies are JSON. Send `Content-Type: application/json`.
- Semesters are written as `YYYYSS`, for example `202601` for winter 2026–2027, `202602`
  for spring 2027 and `202603` for summer 2027.
- Course numbers are written as in the catalog, such as `02340114`.
- Errors return the matching HTTP status and a body like
  `{"error": {"code": "course_not_found", "message": "..."}}`.
- Successful deletions return `204 No Content`.

### Rate limits

Each user can make up to 60 requests per minute, counted across all of their requests.
Responses include these headers:

- `RateLimit-Limit`: the number of requests allowed per minute.
- `RateLimit-Remaining`: the requests left in the current minute.
- `RateLimit-Reset`: the seconds until the count resets.

Requests over the limit get `429 Too Many Requests` with the error code `rate_limited` and
a `Retry-After` header with the seconds to wait. Rejected requests change nothing, so it's
safe to retry them after that time. The API may run on several servers, each counting on
its own, so don't rely on getting exactly 60 requests or on being stopped at exactly 60.

### Layers

Schedules with layers (alternative plans) keep separate courses, lessons and custom events
per layer. Endpoints that change these use the first layer by default. Add `?layer=layer1`
(an id from `GET /layers`) to use another layer. The first layer's id is `default`. See
[Layers](#layers-1) for managing the layers themselves.

## Endpoints

### Account

| Method | Path  | Description |
| ------ | ----- | ----------- |
| GET    | `/me` | The user the key belongs to: `{"uid": "...", "displayName": "..."}` |

### Semesters

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/semesters` | The semesters on the site, newest first, and which ones you have a schedule in |

```json
{
  "latest": "202601",
  "semesters": [
    {"semester": "202601", "start": "2026-10-28", "end": "2027-01-28", "hasSchedule": true}
  ]
}
```

`latest` is the semester the site opens by default. `hasSchedule` is true if the semester
has courses or custom events in any layer.

### Schedule

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/semesters/{semester}/schedule` | The whole saved schedule, including all layers |
| GET | `/semesters/{semester}/courses` | The courses in the schedule |
| GET | `/semesters/{semester}/courses/{course}` | One course in the schedule |
| POST | `/semesters/{semester}/courses` | Add a course. Body: `{"course": "02340114"}` |
| DELETE | `/semesters/{semester}/courses/{course}` | Remove a course |
| PUT | `/semesters/{semester}/courses/{course}/lessons/{type}` | Choose a lesson. Body: `{"number": 11}` |
| DELETE | `/semesters/{semester}/courses/{course}/lessons/{type}` | Clear the lesson of a type |
| PUT | `/semesters/{semester}/courses/{course}/color` | Set the course color. Body: `{"color": "#bf4040"}` |
| DELETE | `/semesters/{semester}/courses/{course}/color` | Restore the automatic color |

A course in the schedule looks like this:

```json
{
  "course": "02340114",
  "name": "מבוא למדעי המחשב מ'",
  "lessons": {"הרצאה": 10, "תרגול": 11},
  "color": null
}
```

`lessons` maps each lesson type to the chosen lesson number. In URLs the lesson type can be
given in Hebrew (URL-encoded) or as one of these names: `lecture`, `tutorial`, `lab`,
`seminar`, `project`, `seminar-project` and `workshop`. A course can be added only if it's
offered in that semester, and a lesson can be chosen only if the course has it.

### Course catalog

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/semesters/{semester}/catalog?q={query}` | Search courses by number or name |
| GET | `/semesters/{semester}/catalog/{course}` | A course's catalog details and all of its lessons |

Search with at least 2 characters: part of a course number (`0234`, also the old 6-digit
form such as `234114`) or of its name, in the catalog's language (Hebrew), ignoring
quotes and gershayim. Exact numbers come first, then numbers that start with the query.
Results are paged with `limit` (1–100, default 20) and `offset`:

```json
{
  "semester": "202601",
  "query": "0234",
  "total": 87,
  "offset": 0,
  "limit": 20,
  "courses": [{"course": "02340114", "name": "מבוא למדעי המחשב מ'", "points": 4}]
}
```

Use the course details to find the lesson numbers to choose. Each lesson has its `type`, `number`, `group`,
`day`, `time`, `building`, `room` and `staff`, in the catalog's language (Hebrew).

### Custom events

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/semesters/{semester}/custom-events` | The custom events |
| POST | `/semesters/{semester}/custom-events` | Add an event |
| PATCH | `/semesters/{semester}/custom-events/{id}` | Change an event's title or time |
| DELETE | `/semesters/{semester}/custom-events/{id}` | Remove an event |
| PUT | `/semesters/{semester}/custom-events/{id}/color` | Set the event color. Body: `{"color": "#4080bf"}` |
| DELETE | `/semesters/{semester}/custom-events/{id}/color` | Restore the automatic color |

Events repeat every week, so they have a day and times but no date:

```json
{
  "title": "Gym",
  "day": "monday",
  "startTime": "08:30",
  "endTime": "10:00",
  "color": "#4080bf"
}
```

`day` is one of `sunday` to `saturday`. Times are `HH:MM`, and `endTime` can be `24:00`.
`color` is optional. When you change an event, send only the fields that change. Responses
also include the event's `id`, and the `start` and `end` values that the site stores.

### Layers

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/semesters/{semester}/layers` | The layers, with their names, visibility and counts |
| POST | `/semesters/{semester}/layers` | Add an empty layer. Optional body: `{"name": "Plan B", "hidden": false}` |
| PATCH | `/semesters/{semester}/layers/{layer}` | Rename, hide or show a layer. Body: `{"name": "Plan A"}`, `{"hidden": true}` or both |
| DELETE | `/semesters/{semester}/layers/{layer}` | Delete a layer with its courses and custom events |
| POST | `/semesters/{semester}/layers/{layer}/duplicate` | Copy a layer with its courses, lessons, custom events and colors |
| POST | `/semesters/{semester}/courses/{course}/move` | Move a course to another layer. Body: `{"to": "layer1"}` |

Layers work as on the site:

- A schedule starts with one layer, `default`. Adding a layer starts using layers.
- Names have up to 20 characters. New layers are named "Layer 2", "Layer 3" and so on unless
  you give a name, and a copy is named "<name> (copy)".
- Hidden layers keep their courses but aren't shown in the calendar or exported.
- Renaming or hiding `default`, and deleting any layer, need at least two layers
  (`409 layers_not_used` otherwise). Deleting `default` moves the next layer into it, with
  its name. When one layer is left, the schedule no longer uses layers.
- Moving a course takes its chosen lessons and color along. It moves from the first layer,
  or from `?layer=`. The responses of `POST` and `PATCH` describe the layer like
  `GET /courses` and `GET /custom-events` together.

### Conflicts

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/semesters/{semester}/conflicts` | The overlapping lessons and custom events of a layer |

It checks the meetings of the chosen lessons and the custom events of the first layer, or of
`?layer=`. Each conflict is a pair of overlapping items:

```json
{
  "semester": "202601",
  "layer": "default",
  "conflicts": [[
    {"kind": "lesson", "course": "02340114", "name": "מבוא למדעי המחשב מ'", "type": "הרצאה",
     "number": 10, "day": "sunday", "startTime": "10:30", "endTime": "12:30"},
    {"kind": "customEvent", "id": "1700000000", "title": "Gym", "day": "sunday",
     "startTime": "11:00", "endTime": "12:00"}
  ]]
}
```

Items that only touch, such as one ending at 12:30 and another starting at 12:30, don't
conflict.

## Examples

```sh
KEY=cf2_...
API=https://api.cf.talisrae.li/v1

# View your courses
curl -H "Authorization: Bearer $KEY" $API/semesters/202601/courses

# Find a course
curl -H "Authorization: Bearer $KEY" "$API/semesters/202601/catalog?q=0234"

# Add a course and choose its lecture
curl -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
     -d '{"course": "02340114"}' $API/semesters/202601/courses
curl -X PUT -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
     -d '{"number": 10}' $API/semesters/202601/courses/02340114/lessons/lecture

# Add a weekly event
curl -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
     -d '{"title": "Gym", "day": "monday", "startTime": "08:30", "endTime": "10:00"}' \
     $API/semesters/202601/custom-events
```
