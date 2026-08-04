# Teacher Scheduler v1

A free, serverless lesson-booking system for a single teacher.

- **Frontend**: React + Vite + TypeScript + MUI + FullCalendar, deployed on **GitHub Pages**.
- **Backend**: **Google Apps Script** (Web App).
- **Storage**: **Google Sheets**.
- **Calendar**: **Google Calendar**.

Workflow: teacher registers students → students sign in with Google → students request
bookings/cancellations → teacher approves/rejects → approved bookings auto-sync to Google
Calendar (and approved cancellations remove events) → teacher can set recurring weekly lessons.

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
3. Delete the default `Code.gs` content. Copy the contents of
   [`apps-script/Code.gs`](apps-script/Code.gs) into `Code.gs`.
4. Add `apps-script/appsscript.json` as a manifest (Settings → Show "appsscript.json" manifest file).
5. Edit the `CONFIG` at the top of `Code.gs`:
   - `TEACHER_EMAILS`: your Google account email(s).
   - `SPREADSHEET_ID` *(optional)*: leave empty since the script is bound to the spreadsheet.
   - `CALENDAR_ID` *(optional)*: leave empty to use your default calendar.
   - `TIME_ZONE`: your time zone (default `Asia/Taipei`).
6. Authorize the required scopes (Sheets, Calendar, userinfo.email) when prompted.
7. **Deploy → New deployment → Web app**:
   - **Execute as:** Me
   - **Who has access:** Anyone with a Google account
   - Copy the **Web app URL** (`https://script.google.com/macros/s/.../exec`).

The Sheets (`Students`, `BookingRequests`, `Bookings`, `RecurringClasses`, `Availability`)
are created automatically on first use.

## Student dashboard

Students see a calendar too: green **available to book** slots, their own lessons in purple, and
their own pending requests (orange booking requests, red cancellation requests). Clicking a green
slot sends a booking request; clicking one of their own lessons sends a cancellation request;
clicking a pending request shows its status. Other students' bookings and requests are never shown —
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
| `getMyRequests` | student | own booking/cancel requests |
| `requestBooking` | student | submit booking request |
| `requestCancellation` | student | submit cancellation request |
| `getAdminData` | teacher | students + slots + requests + bookings + recurring |
| `getPendingRequests` | teacher | pending requests |
| `approveRequest` / `rejectRequest` | teacher | handle a request |
| `listStudents` / `addStudent` / `disableStudent` / `enableStudent` | teacher | student management |
| `createAvailability` / `createWeeklyAvailability` / `blockSlot` / `unblockSlot` / `deleteSlot` | teacher | availability management |
| `createRecurringClass` / `generateRecurringBookings` / `disableRecurringClass` / `enableRecurringClass` / `deleteRecurringClass` | teacher | recurring classes |

## Teacher dashboard

The admin page is calendar-first: the teacher sees availability, lessons, blocked slots and pending
requests all on one calendar. Clicking an **empty time** opens a dialog to create an open slot —
either **this day only** or **weekly** (repeats every week between two dates). Clicking an **event**
opens an action dialog: pending booking/cancellation requests can be **approved or rejected**,
open slots can be **deleted**, blocked slots can be **unblocked**, and approved lessons show details.
A "Pending requests" panel on the right gives quick approve/reject buttons as well.

## Security

- Only the teacher email(s) in `CONFIG.TEACHER_EMAILS` can call teacher actions.
- Only active, registered students can call student actions.
- Apps Script re-validates the caller's identity on every request via `Session.getActiveUser()`
  and rejects mismatched emails — never trust the frontend alone.
# booking
