# Teacher Scheduler v1

A free, serverless lesson-booking system for a single teacher.

- **Frontend**: React + Vite + TypeScript + MUI + FullCalendar, deployed on **GitHub Pages**.
- **Backend**: **Google Apps Script** (Web App).
- **Storage**: **Google Sheets**.
- **Calendar**: **Google Calendar**.

Workflow: teacher registers students → teacher sets up **class types** (e.g. Math, English) and per-student
**booking quotas** for each type → teacher creates open slots (or schedules a lesson directly for a
student, single or weekly) → students sign in with Google and request bookings — but only for class
types where they still have quota → teacher approves/rejects → approved bookings auto-sync to the
teacher's Google Calendar. Only the teacher can cancel lessons; students request bookings only.

Class types are free-form labels the teacher defines. Each student has a quota per class type; every
booking request for that type reserves one quota at submission time, and the quota is returned if the
teacher rejects the request or cancels the resulting lesson. When the teacher disables/deletes a
**regular class** (weekly series), each future occurrence that gets cancelled grants the affected
student 1 quota of that class's type (the teacher can opt out per occurrence).

## Project layout

```
booking/
├── apps-script/          # Google Apps Script backend
│   ├── appsscript.json
│   └── Code.gs
├── web/                  # React frontend
│   └── src/
│       ├── api.ts        # Apps Script client
│       ├── auth.tsx      # Google Sign-In + session
│       ├── mockApi.ts    # in-browser mock backend (local testing)
│       ├── pages/        # Login, Student, Admin, AccessDenied
│       └── components/   # admin sections + calendar
└── .github/workflows/    # GitHub Pages deployment
```

---

## 1. Backend setup (Google Apps Script)

1. Create a **Google Spreadsheet** (this will be the database).
2. In the spreadsheet, open **Extensions → Apps Script**.
3. In the editor's file list, add/create three files and paste their contents:
   - `Code.gs` ← [`apps-script/Code.gs`](apps-script/Code.gs)
   - `Config.gs` ← [`apps-script/Config.gs`](apps-script/Config.gs) *(your settings live here — never overwrite this file when updating)*
   - `appsscript.json` ← [`apps-script/appsscript.json`](apps-script/appsscript.json) (Settings → Show "appsscript.json" manifest file)
4. Edit `Config.gs`:
   - `TEACHER_EMAILS`: your Google account email(s).
   - `SPREADSHEET_ID` *(optional)*: leave empty since the script is bound to the spreadsheet.
   - `CALENDAR_ID` *(optional)*: leave empty to use your default calendar.
   - `TIME_ZONE`: your time zone (default `Asia/Taipei`).
5. Authorize the required scopes (Sheets, Calendar, userinfo.email) when prompted.
6. **Deploy → New deployment → Web app**:
   - **Execute as:** Me
   - **Who has access:** Anyone with a Google account
   - Copy the **Web app URL** (`https://script.google.com/macros/s/.../exec`).

> Updating later: when a new backend version ships, **replace only `Code.gs`** — leave `Config.gs`
> and `appsscript.json` as-is so your emails/calendar/timezone settings are preserved. Then
> Deploy → Manage deployments → Edit → New version → Deploy.

The Sheets (`Students`, `BookingRequests`, `Bookings`, `RecurringClasses`, `Availability`,
`ClassTypes`, `StudentQuotas`) are created automatically on first use. Columns are auto-added to
existing sheets on upgrade, and a default **General** class type is created if none exist — so older
spreadsheets keep working without manual setup.

## Student dashboard

Students see a calendar too: green **available to book** slots, their own lessons in purple, and
their own pending booking requests in orange. A **My quota** card lists the student's remaining quota
per class type; slots whose type has no remaining quota show as grey **no quota** and cannot be
booked (the backend rejects them too). Clicking a bookable green slot sends a booking request;
clicking a lesson just shows its details (cancellations are handled by the teacher); clicking a
pending request shows its status. Other students' bookings and requests are never shown —
`getAvailableSlots` only returns slots that are free (no active booking and no pending request), and
the student endpoints only return the signed-in student's own data.

## 2. Google OAuth client ID (for Sign-In)

1. In [Google Cloud Console](https://console.cloud.google.com), create a project.
2. **APIs & Services → OAuth consent screen** → configure (External, add your own email as test user).
3. **Credentials → Create Credentials → OAuth client ID → Web application**.
   - Add `http://localhost:5173` and your GitHub Pages URL to **Authorized JavaScript origins**.
4. Copy the **Client ID**.

## 3. Frontend setup

```bash
cd web
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

```
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
VITE_USE_MOCK=false
```

Run locally:

```bash
npm run dev        # http://localhost:5173
```

### Demo mode (no backend needed)

Set `VITE_USE_MOCK=true` to preview the whole UI against an in-browser mock
(teacher email is `teacher@gmail.com`, student `alice@gmail.com`).

```bash
VITE_USE_MOCK=true npm run dev
```

## 4. Deploy to GitHub Pages

1. Push the repo to GitHub.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Set repository **Variables** (Settings → Secrets and variables → Actions → Variables):
   - `VITE_GOOGLE_CLIENT_ID`
   - `VITE_APPS_SCRIPT_URL`
4. The workflow in `.github/workflows/deploy.yml` builds and deploys automatically on push to `main`.

---

## Actions API (Apps Script)

All requests `POST` to the web app URL with `{ "action": "...", ... }`.

| action | role | description |
| --- | --- | --- |
| `validateUser` | any | returns `teacher` / `student` / `unauthorized` |
| `getAvailableSlots` | student/teacher | available slots |
| `getMyBookings` | student | own bookings |
| `getMyRequests` | student | own booking requests |
| `requestBooking` | student | submit booking request (checks quota) |
| `getStudentData` | student | own bookings + requests + class types + quotas |
| `getAdminData` | teacher | students + slots + requests + bookings + class types + quotas |
| `getPendingRequests` | teacher | pending requests |
| `approveRequest` / `rejectRequest` | teacher | handle a request (reject returns quota) |
| `listStudents` / `addStudent` / `disableStudent` / `enableStudent` | teacher | student management |
| `listClassTypes` / `addClassType` / `deleteClassType` | teacher | class-type management |
| `setStudentQuota` | teacher | set a student's quota for a class type |
| `createAvailability` / `createWeeklyAvailability` / `cancelBooking` / `blockSlot` / `unblockSlot` / `deleteSlot` | teacher | scheduling & cancellation |
| `createRecurringClass` / `disableRecurringClass` / `enableRecurringClass` / `deleteRecurringClass` | teacher | regular (weekly) class management |

Quota rules:
- `requestBooking` reserves 1 quota of the slot's class type immediately.
- `rejectRequest` and cancelling a quota-consuming booking return the quota.
- `createAvailability`, `createWeeklyAvailability` and `createRecurringClass` take `classTypeId`.
- `cancelBooking`, `disableRecurringClass` and `deleteRecurringClass` take `giveQuota` (default true):
  cancelled **recurring** occurrences grant the student 1 quota of the class type; direct teacher-
  assigned lessons never consume quota.

## Teacher dashboard

The admin page is organized into tabs: **Calendar**, **Students**, **Class types** and **Regular classes**.

- **Calendar**: the teacher sees availability, lessons, blocked slots and pending requests all on one
  calendar. Clicking an **empty time** opens a dialog to create a slot — **this day only** or
  **weekly** — with a **class type** selector and an **"Assign to"** dropdown: **Open slot** (students
  can request it) or a specific **student** (schedules the lesson directly, no quota needed). Clicking
  an **event** opens an action dialog: pending requests can be **approved or rejected**, open slots
  **deleted**, blocked slots **unblocked**, and lessons **cancelled** — cancelling a regular-class
  occurrence offers a **"Give the student 1 quota"** checkbox (checked by default).
- **Students**: register/disable/enable students, and set each student's **quota per class type**
  inline on a matrix (rows = students, columns = class types, editable cells).
- **Class types**: add and delete class types (e.g. Math, English). Deleting a type removes it from
  new scheduling and its quota column disappears.
- **Regular classes**: create a weekly series with a class type, time and date range; pause/resume it,
  or delete it — with the same **give 1 quota** option (checked by default) for every future occurrence
  that is cancelled.

A "Pending requests" panel on the right gives quick approve/reject buttons as well.

## Security

- Only the teacher email(s) in `CONFIG.TEACHER_EMAILS` can call teacher actions.
- Only active, registered students can call student actions.
- Apps Script re-validates the caller's identity on every request via `Session.getActiveUser()`
  and rejects mismatched emails — never trust the frontend alone.
# booking
