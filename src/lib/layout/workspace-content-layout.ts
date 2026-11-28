/** Full-width dashboard workspace content (padding lives on the frame / tab bar). */
export const workspaceContentShellClassName = "w-full";

/** Standard padding for workspace page content (tab panels, mobile fallback). */
export const workspaceContentPaddingClassName = "p-4 md:p-6 lg:p-8";

/** Full workspace content frame (panels + non-tab mobile layout). */
export const workspaceContentFrameClassName = `${workspaceContentShellClassName} ${workspaceContentPaddingClassName}`;

/** Horizontal padding aligned with workspace content frame (tab bar, topbar). */
export const workspaceContentHorizontalPaddingClassName = "px-4 md:px-6 lg:px-8";

/** Tab bar inner row — flush on the left so the first tab meets the edge; keep right inset for actions. */
export const workspaceTabBarFrameClassName = `${workspaceContentShellClassName} flex items-end pr-4 md:pr-6 lg:pr-8`;
