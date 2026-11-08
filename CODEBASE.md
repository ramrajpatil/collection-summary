# Collection Summary (वसुली सारांश) - Codebase Documentation

A local-first daily pigmy-collection app for a savings society. Built with React 19 + TypeScript + Vite and packaged for Android with Capacitor.

Current app version: **1.3.29** (`versionCode 37`).

---

## 📁 Project Structure

```
collection_printing/
├── android/                    # Capacitor Android project
├── src/
│   ├── App.tsx                 # Main app shell, tabs, settings, overlays
│   ├── main.tsx                # Entry point (sets data-platform flag)
│   ├── index.css               # Global styles, glass theme, animations
│   ├── App.css                 # App-specific styles
│   ├── screens/                # Screen components
│   │   ├── CollectionScreen.tsx    # Daily collection entry
│   │   ├── HoldersScreen.tsx       # Holder management
│   │   ├── HolderDetailScreen.tsx  # Holder history, balance & statement
│   │   ├── ReportsScreen.tsx       # Monthly reports
│   │   ├── ExportScreen.tsx        # Collection export/import by date range
│   │   └── SetupScreen.tsx         # Initial setup
│   ├── components/             # Reusable UI components
│   │   ├── BottomSheet.tsx         # Modal bottom sheet
│   │   ├── DatePicker.tsx          # Calendar date picker
│   │   ├── DataBackupSheet.tsx     # Full backup export/import
│   │   ├── Icons.tsx               # SVG icon components
│   │   ├── ScanFlow.tsx            # Camera OCR + manual entry + JSON import
│   │   └── Toast.tsx               # Toast notifications
│   ├── lib/                    # Core library modules
│   │   ├── models.ts               # TypeScript interfaces
│   │   ├── repo.ts                 # Repository interface
│   │   ├── repo.web.ts             # localStorage implementation
│   │   ├── repo.native.ts          # SQLite implementation
│   │   ├── db.ts                   # Repository factory
│   │   ├── settings.ts             # Settings defaults
│   │   ├── i18n.tsx                # Internationalization (Marathi/English)
│   │   ├── theme.tsx               # Dark/light theme
│   │   ├── marathi.ts              # Devanagari digits, date formatting
│   │   ├── names.ts                # Name display helpers
│   │   ├── sort.ts                 # Account number sorting
│   │   ├── reports.ts              # Monthly report calculations
│   │   ├── sheets.ts               # PDF HTML generation
│   │   ├── pdfTemplate.ts          # PDF HTML templates
│   │   ├── pdf.ts                  # Capacitor PDF plugin
│   │   ├── gemini.ts               # Gemini API integration
│   │   ├── scanImport.ts           # JSON scanner import parser
│   │   ├── reminders.ts            # WhatsApp/SMS/call deep links
│   │   ├── notifications.ts        # Collection SMS/WhatsApp notifications
│   │   ├── lock.ts                 # Master password verification
│   │   ├── backup.ts               # Full backup export/import
│   │   ├── collectionExport.ts     # Range-based JSON/CSV export/import
│   │   ├── filesaver.ts            # File save helper
│   │   ├── haptics.ts              # Haptic feedback
│   │   ├── systemUi.ts             # Status bar theme
│   │   ├── backButton.ts           # Android back button handler
│   │   └── demo.ts                 # Demo data
│   └── assets/                   # Static assets
├── capacitor.config.ts           # Capacitor configuration
├── package.json                  # Dependencies & scripts
├── vite.config.ts                # Vite configuration
├── tsconfig.json                 # TypeScript configuration
└── README.md                     # Project documentation
```

---

## 🏗️ Architecture Overview

### Dual Repository Pattern
The app uses a **platform-agnostic repository interface** with two implementations:
- **WebRepository** (`repo.web.ts`) - Uses `localStorage` for browser/PWA
- **NativeRepository** (`repo.native.ts`) - Uses SQLite via `@capacitor-community/sqlite` for Android

```typescript
// Repository interface (repo.ts)
interface Repository {
  init(): Promise<void>
  getProfile(): Promise<Profile | null>
  saveProfile(profile: Profile): Promise<void>
  isSetupComplete(): Promise<boolean>
  setSetupComplete(value: boolean): Promise<void>

  listHolders(options?: ListHoldersOptions): Promise<Holder[]>
  getHolder(id: number): Promise<Holder | null>
  createHolder(input: HolderInput): Promise<Holder>
  updateHolder(id: number, input: HolderInput): Promise<void>
  setHolderActive(id: number, active: boolean): Promise<void>
  deleteHolder(id: number): Promise<void>
  nextAccountNo(): Promise<string>

  getDay(date: string): Promise<DayData>
  setDayLocked(date: string, locked: boolean): Promise<void>
  saveCollection(holderId: number, date: string, amount: number): Promise<void>
  saveCollectionsWithReceipts(date: string, entries: CollectionInput[]): Promise<void>
  deleteCollection(holderId: number, date: string): Promise<void>
  setStartReceipt(date: string, start: number): Promise<void>

  getMonthlyReport(month: string): Promise<MonthlyReport>
  getHolderHistory(id: number): Promise<HolderHistory | null>
  getHolderBalance(id: number): Promise<HolderBalance>
  setOpeningBalance(holderId: number, amount: number, date: string): Promise<void>
  addBalanceReduction(holderId: number, amount: number, date: string): Promise<void>

  exportBackup(): Promise<BackupData>
  importBackup(data: BackupData): Promise<void>
  exportCollections(start: string, end: string): Promise<CollectionExport>
  importCollections(data: CollectionExport): Promise<CollectionImportResult>
  seedDemoData(profile: Profile): Promise<void>
}
```

### Data Models

```typescript
// Core entities (models.ts)
interface Profile {
  societyName: string
  address: string
  agentName: string
  managerName: string
}

interface Holder {
  id: number
  name: string           // Marathi name (uppercase)
  nameEn: string         // English name (optional)
  accountNo: string      // Unique account number
  defaultAmount: number  // Default daily collection amount
  phone: string | null   // Optional phone for reminders
  active: boolean        // Active/inactive status
  createdAt: string
  updatedAt: string
}

interface DayEntry {
  collectionId: number
  holderId: number
  name: string
  nameEn: string
  accountNo: string
  amount: number
  receiptNo: number      // Sequential per day
  defaultAmount: number
  createdAt: string
}

interface DayData {
  date: string
  startReceipt: number   // Configurable starting receipt number
  locked: boolean        // Day-level lock
  entries: DayEntry[]
}

interface HolderBalance {
  openingAmount: number
  openingDate: string | null
  reductions: BalanceReduction[]
  journal: BalanceJournalEntry[]
  current: number        // opening + collections - reductions
}
```

---

## 🎯 Key Features

### 1. Daily Collection Entry (`CollectionScreen.tsx`)
- **Automatic receipt numbering** with configurable start number
- **Quick amount chips** (₹100, 200, 300, 400, 500, 1000, 1500)
- **Search & filter** (All / Pending / Collected), deferred search for smooth typing
- **Optimistic updates**: collect/edit/remove reflects immediately; DB write follows
- **PDF generation** (daily sheet with denominations breakdown)
- **Day lock**: lock a whole day; only the master password can unlock it
- **Collected-amount lock**: editing or removing an already-collected amount requires the master password
- **One-shot unlock**: the password unlock re-locks after each edit/delete/save/close
- **Password visibility (eye) toggle** on both master-password inputs

### 2. Scanner (`ScanFlow.tsx`)
Three entry methods:
1. **Camera** — Gemini OCR of handwritten sheets
2. **Manual entry** — type account numbers and amounts
3. **JSON import** — import `accountNo` + `amount` entries from a `.json` file

All three land on the same review screen:
- Fuzzy account matching (`"01" == "1"`)
- Holder names shown
- Starting receipt field at the top; receipts assigned consecutively
- Date comes from the selected date on the Collection screen
- Unmatched accounts, invalid amounts, duplicates and already-collected holders block saving
- JSON import skips unrecognized items and reports the skipped count

### 3. Holder Management (`HoldersScreen.tsx`)
- Add / Edit / Deactivate / Delete holders
- Search by name or account number (deferred)
- Filter: Active / Inactive / All
- Sort: By account number (numeric) or name
- Auto-suggest next account number
- Full-list serial numbers persist across filters

### 4. Holder History, Balance & Statement (`HolderDetailScreen.tsx`)
- Chronological collection history
- Total, days, first/last collection dates
- **Balance** with opening amount/date, reductions, and a unified journal
- `current = opening + collections (since opening date, or all if none) - reductions`
- **Per-holder statement PDF** generation
- **WhatsApp / SMS / Call** reminders with templated messages

### 5. Monthly Reports (`ReportsScreen.tsx`)
- **3% commission** calculation (rounded to 2 decimal places)
- Per-holder breakdown: days, total, commission
- Per-day breakdown: count, total
- Commission history (last 6 months)
- Regenerate daily sheets from report
- Monthly PDF with commission column

### 6. Notifications (`notifications.ts`)
- SMS notifications are **on by default**
- After a collection, the app opens the **SMS app with the message prefilled** (`sms:` URL) — no `SEND_SMS` permission
- Optional WhatsApp notification opens the chat with the message ready
- Message is Marathi and includes:
  - Society name
  - Today's collection amount
  - Date and **12-hour time with AM/PM**
  - Current balance so far
- No background/SMS permission is requested, which avoids Play Protect blocks

### 7. Data Backup (`DataBackupSheet.tsx`)
- **Export**: JSON with profile, holders, collections, daily meta, locks, balances, reductions
- **Import**: Full restore with confirmation
- Versioned backup format (v1)
- Works offline

### 8. Collection Export/Import (`ExportScreen.tsx`)
- Range selection: day / week / month / custom
- Export as **JSON or CSV**
- Import merges only the exported dates; locked dates are skipped
- Shows imported/skipped counts

### 9. Internationalization (`i18n.tsx`)
- **Marathi (मराठी)** and **English** support
- Devanagari digits (०-९) for Marathi
- Marathi month names
- Persisted language preference

### 10. Theming (`theme.tsx`)
- Dark / Light mode
- System preference detection
- Persisted theme preference
- CSS custom properties for colors

### 11. Offline-First Storage
- **Android**: SQLite (via Capacitor SQLite plugin)
- **Web**: localStorage
- Automatic schema migrations (`name_en`, `locked`)

---

## 🔧 Core Libraries

### `lock.ts` - Master Password
```typescript
MASTER_PASSWORD = '2408'       // Developer/manager master password
verifyMasterPassword(input)    // trim + compare
```
Used for:
- Unlocking a locked collection day
- Editing/removing a collected amount

### `marathi.ts` - Localization Utilities
```typescript
toDevanagariDigits(value)    // 123 → "१२३"
toLatinDigits(value)         // "१२३" → "123"
formatDigits(value, lang)    // Language-aware digit formatting
formatRupees(value, lang)    // "₹ १,२३४.५६" / "₹ 1,234.56"
formatReceipt(value, lang)   // Zero-padded 4-digit receipt numbers
formatDate(isoDate, lang)    // "१५ जानेवारी २०२५" / "15 January 2025"
formatMonth(month, lang)     // "जानेवारी २०२५" / "January 2025"
todayIso()                   // Current date as YYYY-MM-DD
shiftIsoDate(date, days)     // Add/subtract days
```

### `reports.ts` - Commission Calculations
```typescript
COMMISSION_RATE = 0.03
commissionFor(total)                    // Round to 2 decimal places
commissionPeriod(month)                 // { start, end }
buildMonthlyReport(month, rows)         // From raw collection rows (web)
buildMonthlyReportFromSummary(month, holders, daily)  // From SQL aggregates (native)
shiftMonth(month, delta)
currentMonth()
```

### `sort.ts` - Account Number Sorting
```typescript
compareAccountNo(a, b)       // Numeric sort: "999" < "1000", "01" == "1"
// Pure numeric accounts first, then alphanumeric
```

### `names.ts` - Display Helpers
```typescript
holderName(name, nameEn, lang)   // Marathi name for 'mr', English for 'en'
upperName(input)                 // Uppercase for storage
```

### `scanImport.ts` - JSON Scanner Import
```typescript
parseScanImport(text)  // → { entries: { accountNo, amount }[], skipped }
```
Canonical input:
```json
[
  { "accountNo": "001", "amount": 200 },
  { "accountNo": "002", "amount": 150 }
]
```
Also accepts `{ "entries": [...] }`, `[["001", 200]]`, and `{ "001": 200 }`.
Account aliases: `accountNo`, `account_no`, `accountNumber`, `account_number`, `account`, `acno`, `ac_no`, `no`.
Amount aliases: `amount`, `amt`, `value`, `rupees`, `rs`, `total`.

### `pdfTemplate.ts` - HTML Templates
Three templates with embedded CSS for A4 printing:
- `buildSheetHtml()` - Daily collection sheet
- `buildMonthlyHtml()` - Monthly report
- `buildStatementHtml()` - Per-holder statement

All use **Noto Sans Devanagari** font via `@font-face`.

### `gemini.ts` - OCR Integration
```typescript
recognizeWithGemini(base64Image, apiKey)  // Returns GeminiEntry[]
prepareScannedImage(uri)                   // Resize to max 1600px, JPEG 0.85
getGeminiKey() / setGeminiKey()            // localStorage (not backed up)
```

### `reminders.ts` - Communication
```typescript
reminderMessage(profile, lang, holder, amount)
whatsappUrl(phone, message)
smsUrl(phone, message)         // sms:+91...?body=...
telUrl(phone)
normalizePhone(phone)
openExternal(url)
```

### `notifications.ts` - Collection Notifications
```typescript
loadNotifySettings() / saveNotifySettings()
buildCollectionMessage({ societyName, amount, dateIso, balance, now })
sendCollectionNotifications({ profile, holder, amount, dateIso, balance, settings })
```
- SMS: opens the SMS composer, no `SEND_SMS` permission
- WhatsApp: opens the chat with the message prefilled
- Time format: 12-hour with AM/PM (e.g. `वेळ: ०२:०५ PM`)

---

## 📱 Android Integration

### Capacitor Plugins Used
| Plugin | Purpose |
|--------|---------|
| `@capacitor/android` | Core Android runtime |
| `@capacitor/app` | App lifecycle, back button |
| `@capacitor/camera` | Photo capture with in-app edit |
| `@capacitor/filesystem` | File access for PDF sharing |
| `@capacitor/haptics` | Tactile feedback |
| `@capacitor/share` | System share sheet for PDFs |
| `@capacitor/status-bar` | Theme-aware status bar |
| `@capacitor-community/sqlite` | SQLite database |

### Custom Native Plugins
| Plugin | Purpose |
|--------|---------|
| `PdfGeneratorPlugin` | Render HTML → PDF |
| `SystemUiPlugin` | Status/navigation bar theming |
| `FileSaverPlugin` | Save files to Downloads |

> `SmsSenderPlugin` was intentionally removed. The app does **not** declare `SEND_SMS` and never sends SMS in the background.

### Manifest Permissions
- `android.permission.INTERNET`
- `android.permission.VIBRATE`
- `android.permission.USE_BIOMETRIC`
- `android.permission.USE_FINGERPRINT`

### Build Commands
```bash
npm run dev           # Web dev server
npm run build         # Typecheck + production build
npm run lint          # oxlint
npm run test          # Vitest
npm run android:sync  # Build web assets + copy to Android
npm run android:open  # Open in Android Studio
npm run android:apk   # Build debug APK
```

### Release Build
```bash
npm run android:sync
cd android && ./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```

Release APKs are signed with `android/release.keystore` via `android/keystore.properties`.

---

## 🎨 UI Components & Visual System

### `BottomSheet.tsx`
- Accessible modal dialog (`role="dialog"`)
- Backdrop click / Escape key to close
- Configurable title, footer, children
- Glass morphism styling

### `DatePicker.tsx`
- Month/year navigation
- Min/max date constraints
- Marathi/English month names
- Keyboard accessible

### `Icons.tsx`
- Inline SVG icons (Wallet, Users, Chart, Camera, Lock, Eye, etc.)
- Stroke-based, `currentColor` for theming

### `Toast.tsx`
- Auto-dismiss after 6 seconds
- Manual dismiss button
- Slide-in animation

### Performance-Oriented Styling
- `data-platform="native"` is set on `<html>` from Capacitor
- Aurora background is a single composited layer with transform-only animation (no live `mix-blend-mode`)
- Live `backdrop-filter` on native is limited to floating chrome (topbar, tabbar, dock); content cards keep the translucent gradient look
- Lists use `content-visibility: auto` with measured intrinsic sizes
- Entrance animation is staggered only for the first 8 visible rows
- `useDeferredValue` keeps search inputs responsive

---

## 🔐 Settings (`settings.ts` & App.tsx)

```typescript
interface Settings {
  societyName: string
  address: string
  agentName: string
  managerName: string
}
```
- Profile stored in repository (SQLite/localStorage)
- **Gemini API key** stored separately in localStorage (never backed up)
- Theme, language, SMS/WhatsApp notification preferences persisted separately
- Master password lives in `src/lib/lock.ts`

---

## 🧪 Testing

```bash
npm run test          # Vitest (unit tests)
```

Current test files (49 tests):
- `marathi.test.ts` - Date/digit formatting
- `names.test.ts` - Name display logic
- `sort.test.ts` - Account number sorting
- `reports.test.ts` - Commission and monthly report aggregation
- `gemini.test.ts` - OCR JSON parsing
- `reminders.test.ts` - Message templates
- `backup.test.ts` - Backup export/import roundtrip
- `collectionExport.test.ts` - Range export/import helpers
- `notifications.test.ts` - Notification message + 12-hour time
- `scanImport.test.ts` - JSON scanner import parser

---

## 📦 Dependencies

### Production
```json
{
  "@capacitor-community/sqlite": "^8.1.1",
  "@capacitor/android": "^8.6.0",
  "@capacitor/app": "^8.1.2",
  "@capacitor/camera": "^8.2.6",
  "@capacitor/cli": "^8.6.0",
  "@capacitor/core": "^8.6.0",
  "@capacitor/filesystem": "^8.1.5",
  "@capacitor/haptics": "^8.0.2",
  "@capacitor/share": "^8.0.3",
  "@capacitor/status-bar": "^8.0.4",
  "react": "^19.3.1",
  "react-dom": "^19.3.1"
}
```

### Development
```json
{
  "@types/node": "^24.19.2",
  "@types/react": "^19.3.0",
  "@types/react-dom": "^19.3.0",
  "@vitejs/plugin-react": "^6.1.2",
  "oxlint": "^1.89.0",
  "typescript": "~7.0.2",
  "vite": "^8.3.5",
  "vitest": "^5.1.0"
}
```

---

## 🚀 Development Workflow

1. **Start dev server**: `npm run dev`
2. **Make changes** in `src/`
3. **Typecheck**: `npm run build` (runs `tsc -b`)
4. **Lint**: `npm run lint`
5. **Test**: `npm run test`
6. **Android sync**: `npm run android:sync`
7. **Open in Android Studio**: `npm run android:open`
8. **Build debug APK**: `npm run android:apk`
9. **Build release APK**: `npm run android:sync && cd android && ./gradlew assembleRelease`

---

## 📋 Key Implementation Details

### Receipt Numbering
- Per-day sequential numbering
- Configurable start receipt (default: 1)
- `saveCollection` computes the next receipt in SQL (O(1))
- Deletes and start-receipt changes renumber the day in one SQL statement
- Stored in `daily_meta`

### Account Number Sorting
```
Numeric:     001, 002, ..., 999, 1000, 1001
Alphanumeric: A001, B001 (after all numeric)
```
Implemented in SQL (`repo.native.ts`) and JS (`sort.ts`, `repo.web.ts`)

### Commission Calculation
```typescript
commission = round2(total * 0.03)
// round2: Math.round((value + Number.EPSILON) * 100) / 100
```

### Master-Password Locks
- **Day lock**: `repo.setDayLocked(date, true)`; unlock requires `verifyMasterPassword`
- **Collected amount lock**: editing/removing a collected entry requires the password
- Unlock is one-shot; it resets after each save/remove/toggle/sheet close
- Both password inputs have an eye toggle

### Scanner Flow
1. Choose Camera, Manual, or JSON import
2. Camera: Gemini OCR → `GeminiEntry[]`
3. JSON: `parseScanImport()` → `{ accountNo, amount }[]`
4. Match account numbers to holders (fuzzy: `"01" == "1"`)
5. Review: edit, fix unmatched, set start receipt
6. Save with consecutive receipt numbers on the selected date

### Balance Calculation
```typescript
counted = openingDate
  ? collections where date >= openingDate
  : all collections
current = openingAmount + sum(counted) - sum(reductions)
```

### Backup Format (v1)
```json
{
  "version": 1,
  "exportedAt": "2025-01-15T10:30:00.000Z",
  "profile": { "societyName": "...", "...": "..." },
  "setupComplete": true,
  "holders": [{ "id": 1, "name": "...", "...": "..." }],
  "collections": [{ "holderId": 1, "date": "2025-01-15", "amount": 100, "receiptNo": 1 }],
  "dailyMeta": { "2025-01-15": 1 },
  "locks": { "2025-01-15": true },
  "balances": [{ "holderId": 1, "openingAmount": 5000, "openingDate": "2025-01-01" }],
  "balanceReductions": [{ "holderId": 1, "date": "2025-01-10", "amount": 500 }]
}
```

### Collection Export Format
```json
{
  "type": "collection-export",
  "version": 1,
  "exportedAt": "2025-01-15T10:30:00.000Z",
  "range": { "start": "2025-01-01", "end": "2025-01-31" },
  "dailyMeta": { "2025-01-01": 1 },
  "locks": {},
  "collections": [
    { "accountNo": "001", "name": "...", "date": "2025-01-01", "amount": 100, "receiptNo": 1 }
  ]
}
```

### Database Performance
- Native writes use `executeSet(..., true)` so a save/delete is one transaction call
- Monthly reports aggregate in SQL (`GROUP BY holder_id` and `GROUP BY date`)
- Balance queries filter by opening date in SQL
- SQLite runs in WAL mode with `synchronous=NORMAL`
- Indexes: `collections(date)`, `collections(date, id)`, unique `(holder_id, date)`, `balance_reductions(holder_id, date)`

---

## 🔍 File Reference Quick Links

| Feature | Key Files |
|---------|-----------|
| App shell & routing | `App.tsx`, `main.tsx` |
| Daily collection | `CollectionScreen.tsx`, `ScanFlow.tsx` |
| Scanner JSON import | `scanImport.ts`, `ScanFlow.tsx` |
| Holder CRUD | `HoldersScreen.tsx`, `HolderDetailScreen.tsx` |
| Balances | `HolderDetailScreen.tsx`, `repo.native.ts`, `repo.web.ts` |
| Reports | `ReportsScreen.tsx`, `reports.ts` |
| PDF generation | `sheets.ts`, `pdfTemplate.ts`, `pdf.ts` |
| Database (web) | `repo.web.ts` |
| Database (native) | `repo.native.ts` |
| Models | `models.ts` |
| i18n | `i18n.tsx`, `marathi.ts` |
| Theme | `theme.tsx` |
| Gemini OCR | `gemini.ts` |
| Notifications | `notifications.ts` |
| Master password | `lock.ts` |
| Reminders | `reminders.ts` |
| Backup | `backup.ts`, `DataBackupSheet.tsx` |
| Collection export | `collectionExport.ts`, `ExportScreen.tsx` |
| Settings | `settings.ts` |
| Icons | `Icons.tsx` |
| Shared UI | `BottomSheet.tsx`, `DatePicker.tsx`, `Toast.tsx` |

---

## 📝 Notes for Contributors

1. **TypeScript strict mode** enabled - all types must be explicit
2. **Dual repository** - test both web and native paths
3. **Marathi support** - all user-facing strings in `i18n.tsx`
4. **Offline-first** - no network required except Gemini scanning
5. **No `SEND_SMS`** - SMS notifications open the composer; do not re-add the permission
6. **Master password** lives in `src/lib/lock.ts` and is used for day and amount locks
7. **Accessibility** - ARIA labels, keyboard navigation, focus management
8. **Haptic feedback** - `tapFeedback()` on interactive elements
9. **Android back button** - handled via `backButton.ts` push/pop pattern
10. **PDF fonts** - Noto Sans Devanagari embedded via `@font-face`
11. **Performance** - keep blur on floating chrome only, animate transform/opacity, use `content-visibility` for long lists
12. **Version bumps** - update `versionCode` and `versionName` in `android/app/build.gradle`