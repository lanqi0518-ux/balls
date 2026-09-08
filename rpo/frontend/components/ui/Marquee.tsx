"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Marquee({
  children,
  speed = 40,
  fade = true,
  className,
}: {
  children: ReactNode;
  speed?: number;
  fade?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden",
        fade && "[mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]",
        className
      )}
    >
      <div
        className="flex w-max animate-marquee"
        style={{ animationDuration: `${speed}s` }}
      >
        <div className="flex items-center gap-16 pr-16">{children}</div>
        <div className="flex items-center gap-16 pr-16" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
