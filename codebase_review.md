# Codebase Review Report: Teacher Scheduler v1

## Executive Summary

**Teacher Scheduler v1** is a serverless, free-tier lesson booking platform designed for a single teacher and their registered students. It utilizes a **React + Vite + TypeScript + Material UI + FullCalendar** frontend deployed on **GitHub Pages** and a **Google Apps Script** backend integrated with **Google Sheets** (as database) and **Google Calendar** (for schedule syncing).

---

## Codebase Architecture & Structure

```
booking/
├── apps-script/          # Google Apps Script Backend & Manifest
│   ├── Code.gs           # Core backend logic (REST actions, Auth, Sheets, GCalendar)
│   └── appsscript.json   # OAuth scope & Apps Script manifest configuration
├── web/                  # React + Vite TypeScript Frontend
│   ├── src/
│   │   ├── api.ts        # API client for Apps Script with CORS text/plain payload strategy
│   │   ├── mockApi.ts    # Complete localStorage-backed mock API for offline dev/testing
│   │   ├── auth.tsx      # Authentication Context & Google JWT decoding
│   │   ├── types.ts      # TypeScript interfaces and data models
│   │   ├── utils.ts      # Date/time formatting and helper utilities
│   │   ├── pages/        # LoginPage, StudentDashboard, AdminDashboard, AccessDeniedPage
│   │   └── components/   # CalendarView, StudentCalendar, PendingPanel, StudentManagement, RecurringClassManagement
│   ├── package.json
│   └── vite.config.ts
├── .github/workflows/    # CI/CD GitHub Actions workflow deploying to GitHub Pages
├── README.md             # Setup and deployment documentation
└── chat_plan.txt         # Detailed technical specification
```

---

## Comprehensive Module Evaluation

### 1. Frontend Infrastructure & React Components
- **TypeScript & Type Safety**: Clean and robust type definitions in [`web/src/types.ts`](file:///home/anly/documents/Jasmine/booking/web/src/types.ts). All API models (`Student`, `Slot`, `Booking`, `BookingRequest`, `RecurringClass`) strictly reflect sheet schemas.
- **State Management & Routing**: Uses standard React Context (`AuthProvider`) in [`web/src/auth.tsx`](file:///home/anly/documents/Jasmine/booking/web/src/auth.tsx) and React Router 6 HashRouter in [`web/src/App.tsx`](file:///home/anly/documents/Jasmine/booking/web/src/App.tsx) with route protection (`RequireRole`).
- **Interactive Calendar Views**: [`web/src/components/CalendarView.tsx`](file:///home/anly/documents/Jasmine/booking/web/src/components/CalendarView.tsx) (Admin) and [`web/src/components/StudentCalendar.tsx`](file:///home/anly/documents/Jasmine/booking/web/src/components/StudentCalendar.tsx) (Student) use FullCalendar v6 with custom color-coded event rendering for slots, active lessons, blocked times, and pending requests.
- **Offline / Demo Mode**: [`web/src/mockApi.ts`](file:///home/anly/documents/Jasmine/booking/web/src/mockApi.ts) offers a complete mock backend with auto-seeding data in `localStorage` when `VITE_USE_MOCK=true`.

### 2. Backend Infrastructure & Google Apps Script
- **API Endpoint Structure**: Implements a unified POST handler `doPost(e)` in [`apps-script/Code.gs`](file:///home/anly/documents/Jasmine/booking/apps-script/Code.gs) taking action payloads.
- **Database Abstraction**: `readAll_`, `appendRow_`, `updateById_`, and `deleteById_` handle Google Sheets CRUD operations seamlessly.
- **Date Formatting**: Converts native Google Sheets Date objects to consistent ISO wall-clock strings (`yyyy-MM-dd'T'HH:mm:ss`) using `Utilities.formatDate` and configured timezone (`Asia/Taipei`).
- **Google Calendar Integration**: Automatically creates events (`createCalendarEvent_`) on booking approval and removes events (`deleteCalendarEvent_`) on cancellation approval.

---

## Strengths

1. **Zero Cost & Serverless**: Zero hosting costs using GitHub Pages and free Google Workspace/Consumer services.
2. **CORS Workaround Strategy**: Uses `headers: { 'Content-Type': 'text/plain;charset=utf-8' }` in `fetch` calls to prevent browser CORS preflight errors with Apps Script web apps.
3. **Double Booking Prevention**: Filter logic in `getAvailableSlots_` excludes slots that already have `ACTIVE` bookings or `PENDING` booking requests.
4. **Comprehensive Mocking**: Developers can build and preview UI features locally without connecting to Google Cloud/Apps Script.

---

## Technical Recommendations & Improvements

1. **Concurrency Control in Apps Script**:
   - *Observation*: High concurrency calls to `requestBooking_` or `approveRequest_` in Google Sheets read/write operations can experience race conditions.
   - *Recommendation*: Wrap critical write operations in [`apps-script/Code.gs`](file:///home/anly/documents/Jasmine/booking/apps-script/Code.gs) with `LockService.getScriptLock()`.

2. **Apps Script Execution Time Limits**:
   - *Observation*: `createWeeklyAvailability_` and `generateRecurringBookings_` use guard limits (`guard < 400`), which is good for preventing Apps Script execution timeouts (6-minute cap).
   - *Recommendation*: Consider adding pagination or smaller date range restrictions on UI inputs if creating multi-year recurring classes.

3. **Time Zone Alignment**:
   - *Observation*: Ensure `CONFIG.TIME_ZONE` in `Code.gs` aligns with the Google Calendar timezone settings to prevent 1-hour shifts during daylight savings or timezone mismatches.

---

## Verification Status

- Build & Type Checks: Executed `npm run build` within `web/` to confirm zero TypeScript compilation errors and valid Vite build outputs.
