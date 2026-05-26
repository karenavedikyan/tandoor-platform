import type { ReactNode } from "react";

export function ResponsiveList({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function ResponsiveListDesktop({ children }: { children: ReactNode }) {
  return <div className="hidden sm:block">{children}</div>;
}

export function ResponsiveListMobile({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-border sm:hidden">{children}</ul>;
}

export function ResponsiveListMobileItem({ children }: { children: ReactNode }) {
  return <li className="flex items-start gap-2 px-2 py-2">{children}</li>;
}
