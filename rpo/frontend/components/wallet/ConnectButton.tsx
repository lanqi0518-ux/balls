"use client";

import { ConnectButton as RKConnectButton } from "@rainbow-me/rainbowkit";
import { ArrowRight } from "@/components/ui/Icons";
import { cn } from "@/lib/cn";

type Props = {
  size?: "sm" | "md";
  variant?: "primary" | "secondary";
  className?: string;
  label?: string;
};

const sizes = {
  sm: "text-sm px-4 py-1.5 rounded-full",
  md: "text-sm px-5 py-2.5 rounded-full",
};

/**
 * Fully custom-styled wrapper around RainbowKit's ConnectButton.Custom that
 * matches our design system (ink-black primary / paper secondary).
 */
export function ConnectButton({
  size = "sm",
  variant = "primary",
  className,
  label = "Connect wallet",
}: Props) {
  return (
    <RKConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === "authenticated");

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none",
                userSelect: "none",
              },
            })}
            className={className}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    className={cn(
                      "inline-flex items-center gap-2 font-medium transition-all duration-200",
                      variant === "primary"
                        ? "bg-ink-900 hover:bg-ink-800 text-white shadow-soft hover:shadow-card"
                        : "bg-paper-100 hover:bg-paper-200 text-ink-900 border border-line",
                      sizes[size]
                    )}
                  >
                    {label}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    className={cn(
                      "inline-flex items-center gap-2 font-medium",
                      "bg-rose-600 hover:bg-rose-700 text-white",
                      sizes[size]
                    )}
                  >
                    Wrong network
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-2">
                  <button
                    onClick={openChainModal}
                    className={cn(
                      "inline-flex items-center gap-1.5 font-medium border border-line bg-white hover:bg-paper-100 text-ink-900 transition-colors",
                      sizes[size]
                    )}
                  >
                    {chain.hasIcon && chain.iconUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={chain.name}
                        src={chain.iconUrl}
                        className="h-4 w-4 rounded-full"
                      />
                    )}
                    <span className="hidden sm:inline">{chain.name}</span>
                  </button>

                  <button
                    onClick={openAccountModal}
                    className={cn(
                      "inline-flex items-center gap-2 font-medium bg-ink-900 hover:bg-ink-800 text-white transition-colors",
                      sizes[size]
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-forest-300" />
                    <span>
                      {account.displayName}
                      {account.displayBalance
                        ? ` · ${account.displayBalance}`
                        : ""}
                    </span>
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </RKConnectButton.Custom>
  );
}
