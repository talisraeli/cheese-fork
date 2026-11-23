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
- Semesters are written as `YYYYSS`, for example `202601` for winter 2026-2027, `202602`
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
(an id from the `layers` list in `GET /schedule`) to use another layer.

## Endpoints

### Account

| Method | Path  | Description |
| ------ | ----- | ----------- |
| GET    | `/me` | The user the key belongs to: `{"uid": "...", "displayName": "..."}` |

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
| GET | `/semesters/{semester}/catalog/{course}` | A course's catalog details and all of its lessons |

Use it to find the lesson numbers to choose. Each lesson has its `type`, `number`, `group`,
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

## Examples

```sh
KEY=cf2_...
API=https://api.cf.talisrae.li/v1

# View your courses
curl -H "Authorization: Bearer $KEY" $API/semesters/202601/courses

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
