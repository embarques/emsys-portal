/**
 * Tinted outline / menu styles shared by table selection toolbars and
 * view-sheet action bars.
 *
 * Each key maps to one functionality with a distinct hue so users can tell
 * commands apart at a glance. Labels and icons remain required (color is not
 * the only cue).
 */

export const tableSelectionActionStyles = {
  /** Overflow "Actions" menu trigger — violet so it doesn’t read like Print (sky). */
  actions:
    "border-violet-500/45 bg-violet-500/10 text-violet-700 hover:bg-violet-500/15 hover:text-violet-700 dark:text-violet-300 dark:hover:text-violet-300",
  /** Read-only / open detail / view route / open invoice. */
  view: "border-teal-500/30 bg-teal-500/5 text-teal-700 hover:bg-teal-500/10 hover:text-teal-700 dark:text-teal-300 dark:hover:text-teal-300",
  /** Open edit form. */
  edit: "border-blue-500/30 bg-blue-500/5 text-blue-700 hover:bg-blue-500/10 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-300",
  /** Request a change / correction. */
  request:
    "border-violet-500/30 bg-violet-500/5 text-violet-700 hover:bg-violet-500/10 hover:text-violet-700 dark:text-violet-300 dark:hover:text-violet-300",
  /** Print / print signatures / print barcodes / manifests. */
  print:
    "border-sky-500/30 bg-sky-500/5 text-sky-700 hover:bg-sky-500/10 hover:text-sky-700 dark:text-sky-300 dark:hover:text-sky-300",
  /** Documents / manage invoice items (filled brand navy). */
  documents:
    "border-[#1d4379] bg-[#1d4379] text-white hover:border-[#26548f] hover:bg-[#26548f] hover:text-white dark:border-[#1d4379] dark:bg-[#1d4379] dark:text-white dark:hover:border-[#26548f] dark:hover:bg-[#26548f] dark:hover:text-white",
  /** Create invoice / create-from-record / increase loan. */
  create:
    "border-indigo-500/30 bg-indigo-500/5 text-indigo-700 hover:bg-indigo-500/10 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-300",
  /** Map / map route. */
  map: "border-rose-500/30 bg-rose-500/5 text-rose-700 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-300 dark:hover:text-rose-300",
  /** Assign route / assign reserved. */
  assign:
    "border-cyan-500/30 bg-cyan-500/5 text-cyan-700 hover:bg-cyan-500/10 hover:text-cyan-700 dark:text-cyan-300 dark:hover:text-cyan-300",
  /** Change container / transfer between containers. */
  transfer:
    "border-pink-500/30 bg-pink-500/5 text-pink-700 hover:bg-pink-500/10 hover:text-pink-700 dark:text-pink-300 dark:hover:text-pink-300",
  /** Deliver merchandise. */
  deliver:
    "border-lime-600/35 bg-lime-500/5 text-lime-800 hover:bg-lime-500/10 hover:text-lime-800 dark:text-lime-300 dark:hover:text-lime-300",
  /** Change status / bulk status. */
  status:
    "border-orange-500/30 bg-orange-500/5 text-orange-700 hover:bg-orange-500/10 hover:text-orange-700 dark:text-orange-300 dark:hover:text-orange-300",
  /** Optimize route stop order. */
  optimize:
    "border-fuchsia-500/30 bg-fuchsia-500/5 text-fuchsia-700 hover:bg-fuchsia-500/10 hover:text-fuchsia-700 dark:text-fuchsia-300 dark:hover:text-fuchsia-300",
  /** Export Excel / spreadsheet download. */
  export:
    "border-slate-500/35 bg-slate-500/5 text-slate-700 hover:bg-slate-500/10 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-300",
  /** Add note / annotation. */
  note: "border-stone-500/35 bg-stone-500/5 text-stone-700 hover:bg-stone-500/10 hover:text-stone-700 dark:text-stone-300 dark:hover:text-stone-300",
  delete:
    "border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/15 hover:text-destructive",
  /** Mark complete, clear payment, process journal, record payment. */
  complete:
    "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-300",
  /** Mark incomplete, clear/unassign route, return reserved, decrease. */
  caution:
    "border-amber-500/30 bg-amber-500/5 text-amber-700 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-300",
} as const;

/** Text-only tints for dropdown / menu items that mirror the outline button colors. */
export const tableSelectionActionMenuStyles = {
  actions: "text-violet-700 focus:text-violet-700 dark:text-violet-300 dark:focus:text-violet-300",
  view: "text-teal-700 focus:text-teal-700 dark:text-teal-300 dark:focus:text-teal-300",
  edit: "text-blue-700 focus:text-blue-700 dark:text-blue-300 dark:focus:text-blue-300",
  request: "text-violet-700 focus:text-violet-700 dark:text-violet-300 dark:focus:text-violet-300",
  print: "text-sky-700 focus:text-sky-700 dark:text-sky-300 dark:focus:text-sky-300",
  documents: "text-[#1d4379] focus:text-[#1d4379] dark:text-sky-300 dark:focus:text-sky-300",
  create: "text-indigo-700 focus:text-indigo-700 dark:text-indigo-300 dark:focus:text-indigo-300",
  map: "text-rose-700 focus:text-rose-700 dark:text-rose-300 dark:focus:text-rose-300",
  assign: "text-cyan-700 focus:text-cyan-700 dark:text-cyan-300 dark:focus:text-cyan-300",
  transfer: "text-pink-700 focus:text-pink-700 dark:text-pink-300 dark:focus:text-pink-300",
  deliver: "text-lime-800 focus:text-lime-800 dark:text-lime-300 dark:focus:text-lime-300",
  status: "text-orange-700 focus:text-orange-700 dark:text-orange-300 dark:focus:text-orange-300",
  optimize:
    "text-fuchsia-700 focus:text-fuchsia-700 dark:text-fuchsia-300 dark:focus:text-fuchsia-300",
  export: "text-slate-700 focus:text-slate-700 dark:text-slate-300 dark:focus:text-slate-300",
  note: "text-stone-700 focus:text-stone-700 dark:text-stone-300 dark:focus:text-stone-300",
  delete: "text-destructive focus:text-destructive",
  complete: "text-emerald-700 focus:text-emerald-700 dark:text-emerald-300 dark:focus:text-emerald-300",
  caution: "text-amber-700 focus:text-amber-700 dark:text-amber-300 dark:focus:text-amber-300",
} as const;
