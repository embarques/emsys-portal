/** Tinted outline styles for bulk selection toolbar actions. */
export const tableSelectionActionStyles = {
  /** Read-only / open detail. */
  view: "border-teal-500/30 bg-teal-500/5 text-teal-700 hover:bg-teal-500/10 hover:text-teal-700 dark:text-teal-300 dark:hover:text-teal-300",
  /** Open edit form. */
  edit: "border-blue-500/30 bg-blue-500/5 text-blue-700 hover:bg-blue-500/10 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-300",
  print:
    "border-sky-500/30 bg-sky-500/5 text-sky-700 hover:bg-sky-500/10 hover:text-sky-700 dark:text-sky-300 dark:hover:text-sky-300",
  optimize:
    "border-violet-500/30 bg-violet-500/5 text-violet-700 hover:bg-violet-500/10 hover:text-violet-700 dark:text-violet-300 dark:hover:text-violet-300",
  delete:
    "border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/15 hover:text-destructive",
} as const;
