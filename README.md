# Atlas Admin - Pulse Style Sidebar Sample

Original Next.js + Tailwind + shadcn-style sample dashboard.

## Run locally

```bash
npm install
npm run dev
```

Open:

```txt
http://localhost:3000
```

## Test from iPhone / another device on your network

The dev command binds Next.js to all interfaces:

```bash
npm run dev
```

Then open your computer LAN IP from your phone, for example:

```txt
http://10.1.5.142:3000
```

If your LAN IP changes, update `allowedDevOrigins` in `next.config.js`.

## Included

- Pulse-style sidebar behavior
- Expanded desktop sidebar
- Collapsed icon rail sidebar
- Topbar collapse/expand button placed to the right of the sidebar
- Smaller windows show the icon rail
- Light/dark/system theme toggle
- Search popup menu
- User profile dropdown
- Sample dashboard pages
- Workspace root warning fixed with `turbopack.root`
