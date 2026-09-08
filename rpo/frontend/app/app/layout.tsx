import { ReactNode } from "react";
import { AppSidebar, AppTopBar } from "@/components/nav/AppNav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AppTopBar />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
