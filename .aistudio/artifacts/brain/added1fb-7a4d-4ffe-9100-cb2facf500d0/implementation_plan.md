# SummitSync: Spreadsheet Ingestion, Bulk QR Code ZIP Export, and Attendance Check-In Operations

High-fidelity event operations pipeline enabling organizers to import guest rosters from spreadsheets (CSV/Excel) with instant tabular parsing and AI fallback, export standalone QR codes individually or in bulk as a ZIP archive, scan attendee QR codes for check-in verification, and export verified arrival audit logs as spreadsheets.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following user preferences were confirmed during Phase 1 clarification:
> - **Bulk QR Code Export**: Bundled as a clean ZIP archive of high-resolution individual PNG images (`[GuestName]_[ID]_QR.png`), with regular instant single-file PNG download for individual guests.
> - **Spreadsheet Upload & Ingestion**: Instant client-side tabular parser (CSV/TSV/pasted spreadsheet grids) with smart column detection, paired with an optional Gemini AI fallback for irregular or unstructured text rosters.
> - **Attendance Log Spreadsheet Export**: Full audit log containing Attendee Name, Email, Phone, Organization, Role/Category, Gender, Registered Location, Check-in Date, Check-in Time, Session Title, Terminal Name, and Verification Status.

---

## 1. Overview & Core Concept

SummitSync is an event management and on-site access control platform. Event organizers frequently receive attendee rosters in varied spreadsheet formats, need to distribute or print QR codes ahead of time, scan badges/codes at terminal doors, and provide post-event attendance spreadsheets to event stakeholders.

### Target Personas & Core Workflows
1. **Event Lead / Operations Manager**:
   - Uploads guest lists in bulk via `.csv`, `.xlsx`/`.txt` drag-and-drop or spreadsheet copy-paste.
   - Reviews parsed data in an interactive validation grid before committing to the database.
   - Downloads all QR codes at once as a `.zip` archive for badge printing or email marketing distribution, or downloads individual QR codes on demand.
   - Exports the live or final check-in register as a formatted `.csv` spreadsheet with multi-dimensional filtering (by date, session, attendee category, gender, and search terms).
2. **On-Site Scanner Staff**:
   - Uses the mobile/desktop verification terminal with live camera scanning and manual barcode/text lookup.
   - Receives instant audio/visual feedback (Success, Warning: Already Checked In, VIP Alert).
   - Records scan timestamps, session associations, and terminal identifiers into the live attendance log.

---

## 2. User Experience & Visual Design

### Aesthetic Direction & Layout
In compliance with the **SaaS & Dashboard Guidelines** (`references/3_saas_dashboard.md`), SummitSync utilizes a focused, dark slate command center palette (`#020617` and `#0f172a`) with high-intent emerald (`#10b981`) accent actions, amber (`#f59e0b`) VIP alerts, and crisp tabular data typography.

- **Typography**: Clean `Plus Jakarta Sans` for crisp interface labels and navigation; monospace tabular numerals (`font-mono tabular-nums`) for scan timestamps, counts, and attendee IDs to eliminate jitter.
- **Top Bar Contract**: Breadcrumb and event wordmark on the left, clear mode navigation tabs, and quick status indicator (Live Sync Active).
- **Zero-Pill Discipline**: Metadata displayed as unboxed, quiet typography separated by middle dots (`·`) rather than decorative candy capsules.
- **Single-Elevation Depth**: Flat slate panels with 1px border lines (`border border-white/5` or `border-slate-800`).

### Key User Flows

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SUMMITSYNC USER FLOWS                           │
└────────────────────────────────────────────────────────────────────────┘

  1. SPREADSHEET IMPORT
  [Drop CSV / Paste Excel] ──► [Instant Tabular Parser] ──► [AI Column Mapper]
                                        │                           │
                                        ▼                           ▼
                               [Validation Preview Table (Edit / Exclude)]
                                        │
                                        ▼
                               [Commit to Database]

  2. QR CODE EXPORT
  [Guest Roster View] ────────┬──► [Single Guest]: Download [Name]_QR.png
                              └──► [Bulk Export]: Select All / Filtered
                                          │
                                          ▼
                                   [Generate PNGs]
                                          │
                                          ▼
                                   [Bundle into ZIP] ──► Download .zip

  3. SCANNING & ARRIVALS
  [Door Scanner (Camera/Laser)] ──► [Decode QR / Look Up] ──► [Validate Event & Session]
                                                                     │
                                  ┌──────────────────────────────────┴─────────────┐
                                  ▼                                                ▼
                         [First-Time Check-In]                            [Duplicate Warning]
                        (Audio Beep + VIP Alert)                        (Show Previous Timestamp)
                                  │                                                │
                                  └──────────────────┬─────────────────────────────┘
                                                     ▼
                                            [Log to Supabase DB]

  4. SPREADSHEET EXPORT
  [Attendance Logs Tab] ──► [Filter by Day / Session / Category] ──► [Download CSV Audit Log]
```

---

## 3. Key Product Decisions & Trade-Offs

| Decision | Chosen Approach | Rationale | Alternatives Considered |
| :--- | :--- | :--- | :--- |
| **Client-Side Spreadsheet Parsing** | Native CSV/TSV regex parser with PapaParse/tabular logic + manual text cleaner | Zero server latency, instant processing for 10,000+ rows, works completely offline without API quota consumption. | Gemini-only parser (slow for clean sheets, fails on token limits for large files). |
| **AI Fallback for Messy Data** | Gemini 2.5 Flash structured JSON extractor (`@google/genai`) | Automatically rescues unformatted text, unstructured email dumps, or copy-pasted multi-line rosters when tabular columns are missing. | Rigid error rejects (forces users to manually reformat external spreadsheets). |
| **Bulk QR Generation & Download** | In-browser canvas QR rendering + `JSZip` client packaging | Downloads directly in the user's browser with no server storage cost, bandwidth bottleneck, or temporary file cleanup needed. | Server-side ZIP generation (adds backend dependencies and storage complexity). |
| **QR Code Payload Format** | Compact JSON payload `{"id":"...","event_id":"...","name":"...","cat":"..."}` + fallback raw ID string | Enables instantaneous offline decode and verification while remaining compact enough for low-resolution camera sensors. | Full URL redirect (requires internet connectivity for every scanner scan). |
| **Attendance Log Export** | Formatted RFC-4180 CSV export with UTF-8 BOM | Directly opens in Microsoft Excel, Google Sheets, and Apple Numbers without character corruption or delimiter misdetection. | Plain JSON or PDF-only (cumbersome for downstream data teams and HR). |

---

## 4. Technical Architecture & Data Strategy

```
┌───────────────────────────────────────────────────────────────────────────┐
│                          SUMMITSYNC ARCHITECTURE                          │
└───────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────┐
                    │       App.tsx           │
                    │  (Session & Navigation) │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │    EventTerminal.tsx    │
                    │  (State, Realtime Sync) │
                    └───────────┬─────────────┘
                                │
        ┌───────────────────────┼────────────────────────┐
        │                       │                        │
┌───────▼────────┐      ┌───────▼────────┐       ┌───────▼────────┐
│  SmartUpload   │      │  Guest Roster  │       │ AttendanceLog  │
│ - Instant CSV  │      │ - Single QR DL │       │ - Live Stream  │
│ - AI Fallback  │      │ - Bulk QR ZIP  │       │ - Multi-Filter │
│ - Data Preview │      │ - VIP Flagging │       │ - CSV Export   │
└────────────────┘      └────────────────┘       └───────┬────────┘
                                                         │
                                                 ┌───────▼────────┐
                                                 │ Attendance     │
                                                 │ Scanner (Cam)  │
                                                 │ - Dedup Guard  │
                                                 │ - Sound / Haptic│
                                                 └────────────────┘
```

### Component Structure & Responsibilities

1. **`components/SmartUpload.tsx` (Enhanced)**:
   - **File Upload & Paste Interface**: Supports `.csv`, `.tsv`, `.txt`, `.xlsx` text copy-paste.
   - **Tabular Parsing Engine**: Auto-splits rows and comma/tab delimiters, strips enclosing quotes, normalizes header casing (`First Name`, `Surname` -> `name`; `Email Address` -> `email`; `Company/Org` -> `company`; `Category/Ticket` -> `category`; `Sex/Gender` -> `gender`; `City/Country` -> `location`).
   - **Gemini Fallback**: Invoked when columns cannot be determined or user requests AI Smart Mapping.
   - **Interactive Preview & Edit Modal**: Shows exact parsed records, highlights missing fields, allows inline corrections before final database commit.

2. **`components/QRDownloadManager.ts` (New Utility)**:
   - **Single Download (`downloadSingleQR`)**: Renders QR code on hidden canvas with attendee name & category footer (optional clean border), converts to PNG Blob, triggers browser download as `[GuestName]_QR.png`.
   - **Bulk Download (`downloadBulkQRZip`)**: Iterates through selected/all guests, renders high-res PNG for each guest, packs into a `.zip` archive via `jszip`, reports progress bar (e.g. "Generating 45 of 200 QR codes..."), and downloads `[EventName]_QR_Codes.zip`.

3. **`components/AttendanceScanner.tsx` (Enhanced)**:
   - Embedded HTML5 QR Code Scanner with camera switching and torch controls.
   - Audio feedback synthesizer (Web Audio API oscillator for crisp chime on success, double low-tone on duplicate).
   - Duplicate check-in detection with friendly prompt displaying previous check-in time and session.
   - Manual search-and-check-in input for guests unable to scan their screen.

4. **`components/EventTerminal.tsx` (Enhanced)**:
   - Guest CRM tab with single and bulk QR download actions.
   - Arrival Logs tab with comprehensive filtering (Day, Session, Role, Gender, Search).
   - Spreadsheet Export button generating a clean CSV audit log with full metadata.

5. **`lib/supabase.ts` & Missing Component Restoration**:
   - Provide clean fallback/mock authentication and Supabase client configuration so the application runs seamlessly in local preview and connects to the user's Supabase instance.
   - Restore missing modular components (`BadgePreview`, `StaffForm`, `AnalyticsDashboard`, `SessionManager`, `TagDesigner`, `FormBuilder`, `CommunicationHub`, `CommSettings`) so the entire application builds and runs error-free.

---

## 5. Verification & Acceptance Criteria

1. **Spreadsheet Ingestion**:
   - Uploading a standard CSV or pasting Excel rows immediately populates the preview table without delay.
   - Uploading unstructured text correctly triggers the Gemini AI fallback to extract valid guest objects.
   - Guests with or without email addresses are committed to the database without collision errors.
2. **QR Code Export**:
   - Clicking "Download QR" on an individual guest downloads a crisp PNG file containing only that guest's QR code.
   - Clicking "Download All QRs (ZIP)" compresses all attendee QR codes into a single downloadable `.zip` file with individual PNGs named clearly after each attendee.
3. **Check-In Scanning**:
   - Scanning a generated QR code immediately marks the guest as checked-in and records the timestamp and session in `attendance_logs`.
   - Scanning the same code again displays a clear "Already Checked In" warning with the prior timestamp.
4. **Attendance Spreadsheet Export**:
   - Clicking "Export CSV" in the Arrival Logs downloads a complete spreadsheet matching all selected filters and containing full audit details.
5. **Compilation & Stability**:
   - Application compiles cleanly with `npm run build` and runs on port 3000 with zero console errors.
