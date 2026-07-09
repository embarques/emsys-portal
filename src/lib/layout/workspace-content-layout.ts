/** Max-width + horizontal centering for dashboard workspace content. */
export const workspaceContentShellClassName = "mx-auto w-full max-w-[1600px]";

/** Standard padding for workspace page content (tab panels, mobile fallback). */
export const workspaceContentPaddingClassName = "p-4 md:p-6 lg:p-8";

/** Full workspace content frame (panels + non-tab mobile layout). */
export const workspaceContentFrameClassName = `${workspaceContentShellClassName} ${workspaceContentPaddingClassName}`;

/** Horizontal padding aligned with workspace content frame (tab bar, topbar). */
export const workspaceContentHorizontalPaddingClassName = "px-4 md:px-6 lg:px-8";

/** Tab bar inner row — same max width and horizontal inset as content. */
export const workspaceTabBarFrameClassName = `${workspaceContentShellClassName} flex items-end ${workspaceContentHorizontalPaddingClassName}`;
