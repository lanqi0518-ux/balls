import { ReactNode } from "react";
import { AppSidebar, AppTopBar } from "@/components/nav/AppNav";
import { NetworkStatus } from "@/components/app/NetworkStatus";
import { Providers } from "@/app/providers";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <NetworkStatus />
      <div className="flex min-h-screen">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppTopBar />
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </Providers>
  );
}
