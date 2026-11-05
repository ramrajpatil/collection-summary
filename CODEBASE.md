# Collection Summary (वसुली सारांश) - Codebase Documentation

A local-first daily pigmy-collection app for a savings society. Built with React 19 + TypeScript + Vite and packaged for Android with Capacitor.

---

## 📁 Project Structure

```
collection_printing/
├── android/                    # Capacitor Android project
├── src/
│   ├── App.tsx                 # Main app component with routing/state
│   ├── main.tsx                # Entry point
│   ├── index.css               # Global styles
│   ├── App.css                 # App-specific styles
│   ├── screens/                # Screen components
│   │   ├── CollectionScreen.tsx    # Daily collection entry
│   │   ├── HoldersScreen.tsx       # Holder management
│   │   ├── HolderDetailScreen.tsx  # Holder history & statement
│   │   ├── ReportsScreen.tsx       # Monthly reports
│   │   └── SetupScreen.tsx         # Initial setup
│   ├── components/             # Reusable UI components
│   │   ├── BottomSheet.tsx         # Modal bottom sheet
│   │   ├── DatePicker.tsx          # Calendar date picker
│   │   ├── DataBackupSheet.tsx     # Export/import backup
│   │   ├── Icons.tsx               # SVG icon components
│   │   ├── ScanFlow.tsx            # Camera + Gemini OCR flow
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
│   │   ├── reminders.ts            # WhatsApp/SMS reminders
│   │   ├── backup.ts               # Backup export/import
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
  saveCollection(holderId: number, date: string, amount: number): Promise<void>
  saveCollectionsWithReceipts(date: string, entries: CollectionInput[]): Promise<void>
  deleteCollection(holderId: number, date: string): Promise<void>
  setStartReceipt(date: string, start: number): Promise<void>
  getMonthlyReport(month: string): Promise<MonthlyReport>
  getHolderHistory(id: number): Promise<HolderHistory | null>
  exportBackup(): Promise<BackupData>
  importBackup(data: BackupData): Promise<void>
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
  createdAt: string      // ISO timestamp
  updatedAt: string      // ISO timestamp
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
  entries: DayEntry[]
}

interface MonthlyReport {
  month: string          // YYYY-MM
  periodStart: string
  periodEnd: string
  total: number
  commission: number     // 3% of total
  days: number
  accounts: number
  holders: MonthlyHolderRow[]
  daily: MonthlyDayRow[]
}
```

---

## 🎯 Key Features

### 1. Daily Collection Entry (`CollectionScreen.tsx`)
- **Automatic receipt numbering** with configurable start number
- **Quick amount chips** (₹100, 200, 300, 400, 500, 1000, 1500)
- **Search & filter** (All / Pending / Collected)
- **Per-holder amount editing** via bottom sheet
- **PDF generation** (daily sheet with denominations breakdown)
- **Gemini-powered scanning** of handwritten collection sheets

### 2. Holder Management (`HoldersScreen.tsx`)
- Add / Edit / Deactivate / Delete holders
- Search by name or account number
- Filter: Active / Inactive / All
- Sort: By account number (numeric) or name
- Auto-suggest next account number
- Full-list serial numbers persist across filters

### 3. Holder History & Statement (`HolderDetailScreen.tsx`)
- Chronological collection history
- Total, days, first/last collection dates
- **Per-holder statement PDF** generation
- **WhatsApp / SMS / Call** reminders with templated messages

### 4. Monthly Reports (`ReportsScreen.tsx`)
- **3% commission** calculation (rounded to 2 decimal places)
- Per-holder breakdown: days, total, commission
- Per-day breakdown: count, total
- Commission history (last 6 months)
- Regenerate daily sheets from report
- Monthly PDF with commission column

### 5. Data Backup (`DataBackupSheet.tsx`)
- **Export**: JSON with profile, holders, collections, daily meta
- **Import**: Full restore with confirmation
- Versioned backup format (v1)
- Works offline

### 6. Internationalization (`i18n.tsx`)
- **Marathi (मराठी)** and **English** support
- Devanagari digits (०-९) for Marathi
- Marathi month names
- RTL-aware layouts
- Persisted language preference

### 7. Theming (`theme.tsx`)
- Dark / Light mode
- System preference detection
- Persisted theme preference
- CSS custom properties for colors

### 8. Offline-First Storage
- **Android**: SQLite (via Capacitor SQLite plugin)
- **Web**: localStorage
- Automatic schema migration (adds `name_en` column if missing)

---

## 🔧 Core Libraries

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
COMMISSION_RATE = 0.03       // 3%
commissionFor(total)         // Round to 2 decimal places
commissionPeriod(month)      // { start: YYYY-MM-01, end: YYYY-MM-last }
buildMonthlyReport(month, rows)  // Aggregates from collection rows
shiftMonth(month, delta)     // Navigate months
currentMonth()               // Current YYYY-MM
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

### `pdfTemplate.ts` - HTML Templates
Three templates with embedded CSS for A4 printing:
- `buildSheetHtml()` - Daily collection sheet
- `buildMonthlyHtml()` - Monthly report
- `buildStatementHtml()` - Per-holder statement

All use **Noto Sans Devanagari** font via `@font-face` for proper Marathi rendering.

### `gemini.ts` - OCR Integration
```typescript
recognizeWithGemini(base64Image, apiKey)  // Returns GeminiEntry[]
prepareScannedImage(uri)                   // Resize to max 1600px, JPEG 0.85
getGeminiKey() / setGeminiKey()            // localStorage (not backed up)
```
- Uses **Gemini 3.8 Flash** via Generative Language API
- Structured JSON output with response schema
- In-app camera with crop/edit (Capacitor Camera plugin)

### `reminders.ts` - Communication
```typescript
reminderMessage(profile, lang, holder, amount)  // Templated message
whatsappUrl(phone, message)    // wa.me link
smsUrl(phone, message)         // sms: link
telUrl(phone)                  // tel: link
normalizePhone(phone)          // Strip non-digits, handle +91
openExternal(url)              // Capacitor App.openUrl or window.open
```

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

### Native PDF Generation (`pdf.ts`)
```typescript
interface PdfGeneratorPlugin {
  generate(options: { html: string; fileName: string; baseUrl?: string }): Promise<PdfGeneratorResult>
}
```
Implemented in Android via `PdfGenerator` plugin (registered via Capacitor).

### Build Commands
```bash
npm run dev           # Web dev server
npm run build         # Typecheck + production build
npm run lint          # oxlint
npm run android:sync  # Build web assets + copy to Android
npm run android:open  # Open in Android Studio
npm run android:apk   # Build debug APK
```

### Release Signing
1. Copy `keystore.properties.example` → `android/keystore.properties`
2. Create `android/release.keystore`
3. `npm run android:sync && cd android && ./gradlew assembleRelease`
4. Output: `android/app/build/outputs/apk/release/app-release.apk`

---

## 🎨 UI Components

### `BottomSheet.tsx`
- Accessible modal dialog (ARIA role="dialog")
- Backdrop click / Escape key to close
- Configurable title, footer, children
- Glass morphism styling

### `DatePicker.tsx`
- Month/year navigation
- Min/max date constraints
- Marathi/English month names
- Keyboard accessible

### `Icons.tsx`
20+ inline SVG icons (Wallet, Users, Chart, Camera, etc.)
- Stroke-based, currentColor for theming
- Consistent 24×24 viewBox

### `Toast.tsx`
- Auto-dismiss after 6 seconds
- Manual dismiss button
- Slide-in animation

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
- Theme & language persisted separately

---

## 🧪 Testing

```bash
npm run test          # Vitest (unit tests)
```

Test files:
- `marathi.test.ts` - Date/digit formatting
- `names.test.ts` - Name display logic
- `sort.test.ts` - Account number sorting
- `reports.test.ts` - Commission calculations
- `gemini.test.ts` - JSON parsing
- `reminders.test.ts` - Message templates
- `backup.test.ts` - Export/import roundtrip

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
8. **Build APK**: `npm run android:apk`

---

## 📋 Key Implementation Details

### Receipt Numbering
- Per-day sequential numbering
- Configurable start receipt (default: 1)
- Auto-renumbering on insert/delete
- Stored in `daily_meta` table

### Account Number Sorting
```
Numeric:     001, 002, ..., 999, 1000, 1001
Alphanumeric: A001, B001 (after all numeric)
```
Implemented in SQL (`repo.native.ts`) and JS (`sort.ts`, `repo.web.ts`)

### Commission Calculation
```typescript
// Per holder
commission = round2(holderTotal * 0.03)

// Monthly total
commission = round2(monthlyTotal * 0.03)

// round2 uses: Math.round((value + Number.EPSILON) * 100) / 100
```

### Scanner Flow
1. Check Gemini API key configured
2. Open camera (in-app crop/edit)
3. Resize image → base64 JPEG
4. Send to Gemini API with structured prompt
5. Parse JSON response → `GeminiEntry[]`
6. Match account numbers to holders (fuzzy: "01" == "1")
7. Review screen: edit amounts, fix unmatched
8. Save with sequential receipt numbers

### Backup Format (v1)
```json
{
  "version": 1,
  "exportedAt": "2025-01-15T10:30:00.000Z",
  "profile": { "societyName": "...", ... },
  "setupComplete": true,
  "holders": [{ "id": 1, "name": "...", ... }],
  "collections": [{ "holderId": 1, "date": "2025-01-15", "amount": 100, "receiptNo": 1, ... }],
  "dailyMeta": { "2025-01-15": 1 }
}
```

---

## 🔍 File Reference Quick Links

| Feature | Key Files |
|---------|-----------|
| App entry & routing | `App.tsx`, `main.tsx` |
| Daily collection | `CollectionScreen.tsx`, `ScanFlow.tsx` |
| Holder CRUD | `HoldersScreen.tsx`, `HolderDetailScreen.tsx` |
| Reports | `ReportsScreen.tsx`, `reports.ts` |
| PDF generation | `sheets.ts`, `pdfTemplate.ts`, `pdf.ts` |
| Database (web) | `repo.web.ts` |
| Database (native) | `repo.native.ts` |
| Models | `models.ts` |
| i18n | `i18n.tsx`, `marathi.ts` |
| Theme | `theme.tsx` |
| Gemini OCR | `gemini.ts` |
| Reminders | `reminders.ts` |
| Backup | `backup.ts`, `DataBackupSheet.tsx` |
| Settings | `settings.ts` |
| Icons | `Icons.tsx` |
| Components | `BottomSheet.tsx`, `DatePicker.tsx`, `Toast.tsx` |

---

## 📝 Notes for Contributors

1. **TypeScript strict mode** enabled - all types must be explicit
2. **Dual repository** - test both web and native paths
3. **Marathi support** - all user-facing strings in `i18n.tsx`
4. **Offline-first** - no network required except Gemini scanning
5. **Accessibility** - ARIA labels, keyboard navigation, focus management
6. **Haptic feedback** - `tapFeedback()` on all interactive elements
7. **Android back button** - handled via `backButton.ts` push/pop pattern
8. **PDF fonts** - Noto Sans Devanagari embedded via `@font-face` in templates