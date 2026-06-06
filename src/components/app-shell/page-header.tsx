import { ReactNode } from "react";
export function PageHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div><h2 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h2><p className="mt-2 text-muted-foreground">{description}</p></div>
    {actions ? <div className="flex gap-2">{actions}</div> : null}
  </div>;
}
