# NetLink NetStore

Official application repository and ecosystem catalog for NetLink. This repository hosts application packages and the central `applications.json` catalog for NetStore installations, updates, and feature extensions.

---

## Directory Structure

```text
NetLink-NetStore/
├── applications/
│   ├── applications.json   (Central app catalog and store metadata)
│   ├── version.json        (Store version tag)
│   ├── docker-manager/     (Application package)
│   └── test-app/           (Application package)
└── README.md
```

---

## Design Guidelines & UI/UX Standards (Design-Vorschriften)

To ensure all applications in NetStore maintain a cohesive, modern, and high-quality visual identity within the NetLink ecosystem, developers must adhere to the following design standards:

### 1. Visual Aesthetics & Theme Integration
- **Dark Mode & Palette**: NetLink uses a modern dark theme with deep slate backgrounds (`slate-950` / `#020617` base). Avoid using plain light backgrounds or unstyled white cards.
- **Glassmorphism**: Utilize semi-transparent dark containers (`bg-slate-900/60` or `bg-slate-800/40`), subtle background blurs (`backdrop-blur-md`), and thin translucent borders (`border border-white/10` or `border-slate-700/50`).
- **Curated Accent Colors**: Use specific color accents for visual hierarchy:
  - **Primary Actions / Highlights**: Indigo (`#6366f1` / `indigo-500`)
  - **Success / Status**: Emerald (`#10b981` / `emerald-500`)
  - **Warnings / Caution**: Amber (`#f59e0b` / `amber-500`)
  - **Destructive Actions / Errors**: Rose (`#f43f5e` / `rose-500`)
  - **Utilities / System**: Blue (`#2496ed`) or Cyan (`#06b6d4`)

### 2. Typography & Hierarchy
- **Font Selection**: Use sans-serif fonts matching NetLink's UI (`Outfit`, `Inter`, or system sans-serif) for titles and body text. Use monospaced fonts (`Fira Code`, `JetBrains Mono`) for logs, code snippets, IP addresses, and terminal output.
- **Contrast**: Ensure text is clearly readable on dark backgrounds (`text-slate-100` for titles, `text-slate-300` for body text, `text-slate-400` / `text-slate-500` for secondary metadata).

### 3. Iconography
- **Lucide Icons**: Use line icons from [Lucide React](https://lucide.dev/) (`lucide-react`) with consistent stroke weight (`1.5px` – `2px`).
- **Store Metadata**: Assign a recognized Lucide icon name (e.g. `"icon": "Container"`) and matching HEX color (`"color": "#2496ed"`) in `applications.json`.

### 4. Layout & Responsiveness
- **Window Fit**: Apps render inside dynamic NetLink windows or tabs. Root containers must use flexible sizing classes (`w-full h-full flex flex-col overflow-hidden` or `overflow-y-auto`).
- **Spacing**: Use standard spacing scale (`p-4` to `p-6`, `gap-3` to `gap-6`) to keep screens uncluttered.

### 5. Interactivity & Feedback
- **Hover & Active States**: Provide instant interactive visual feedback using smooth transitions (`transition-all duration-200 ease-in-out`).
- **Loading & State Signals**: Display spinners, skeleton loaders, or toast alerts during asynchronous requests or background execution.

---

## Submitting an Application

To publish a new application to NetStore:
1. Place your application folder inside `applications/<app-id>/`.
2. Add your app's technical manifest (`index.json`), `frontend/main.tsx`, and optional `local_server/` or `relay/` logic.
3. Add your store entry to `applications/applications.json` containing `id`, `name`, `author`, `category`, `icon`, `color`, `shortDesc`, and `fullDesc`.

