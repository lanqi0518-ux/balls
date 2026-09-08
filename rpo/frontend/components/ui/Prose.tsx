import { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Editorial-quality prose wrapper — matches Stripe / Anthropic / Notion docs
 * style. Handles headings, paragraphs, lists, code, blockquotes, tables and
 * horizontal rules with our design tokens.
 */
export function Prose({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-[15.5px] text-ink-600 leading-[1.75] max-w-none",
        // Headings
        "[&_h1]:font-display [&_h1]:text-4xl [&_h1]:lg:text-5xl [&_h1]:text-ink-900 [&_h1]:tracking-tight [&_h1]:mt-0 [&_h1]:mb-8",
        "[&_h2]:font-display [&_h2]:text-3xl [&_h2]:lg:text-4xl [&_h2]:text-ink-900 [&_h2]:tracking-tight [&_h2]:mt-16 [&_h2]:mb-5 [&_h2]:scroll-mt-24",
        "[&_h3]:text-xl [&_h3]:text-ink-900 [&_h3]:font-semibold [&_h3]:mt-10 [&_h3]:mb-3 [&_h3]:scroll-mt-24",
        "[&_h4]:text-base [&_h4]:text-ink-900 [&_h4]:font-semibold [&_h4]:mt-8 [&_h4]:mb-2 [&_h4]:uppercase [&_h4]:tracking-[0.14em]",
        // Body text
        "[&_p]:mb-5 [&_p]:text-ink-600",
        "[&_p_strong]:text-ink-900 [&_p_strong]:font-semibold",
        "[&_p_em]:italic",
        // Links
        "[&_a]:text-forest-500 [&_a]:font-medium [&_a]:underline [&_a]:decoration-forest-500/25 [&_a]:underline-offset-4 hover:[&_a]:decoration-forest-500",
        // Lists
        "[&_ul]:my-5 [&_ul]:pl-5 [&_ul]:space-y-2 [&_ul>li]:pl-2 [&_ul>li]:relative [&_ul>li]:before:content-['\\2022'] [&_ul>li]:before:absolute [&_ul>li]:before:-left-3 [&_ul>li]:before:text-forest-500 [&_ul>li]:before:font-bold",
        "[&_ol]:my-5 [&_ol]:pl-6 [&_ol]:list-decimal [&_ol]:marker:text-ink-500 [&_ol>li]:pl-2 [&_ol>li]:mb-2",
        // Inline code
        "[&_code]:font-mono [&_code]:text-[0.88em] [&_code]:bg-paper-200 [&_code]:text-forest-500 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:border [&_code]:border-line",
        // Code blocks
        "[&_pre]:font-mono [&_pre]:text-[13px] [&_pre]:bg-ink-900 [&_pre]:text-ink-100 [&_pre]:rounded-2xl [&_pre]:p-6 [&_pre]:my-6 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-line-strong [&_pre_code]:bg-transparent [&_pre_code]:border-0 [&_pre_code]:p-0 [&_pre_code]:text-ink-100",
        // Blockquotes
        "[&_blockquote]:border-l-2 [&_blockquote]:border-forest-500 [&_blockquote]:pl-5 [&_blockquote]:my-6 [&_blockquote]:italic [&_blockquote]:text-ink-500",
        // Tables
        "[&_table]:w-full [&_table]:my-6 [&_table]:text-sm [&_table]:border [&_table]:border-line [&_table]:rounded-xl [&_table]:overflow-hidden",
        "[&_th]:text-left [&_th]:p-3 [&_th]:bg-paper-100 [&_th]:text-[11px] [&_th]:uppercase [&_th]:tracking-[0.14em] [&_th]:text-ink-500 [&_th]:font-medium [&_th]:border-b [&_th]:border-line",
        "[&_td]:p-3 [&_td]:border-b [&_td]:border-line [&_td]:text-ink-600 [&_tr:last-child_td]:border-0",
        // HR
        "[&_hr]:my-14 [&_hr]:border-line",
        // Figures / captions
        "[&_figcaption]:text-xs [&_figcaption]:text-ink-500 [&_figcaption]:mt-3 [&_figcaption]:text-center [&_figcaption]:italic",
        className
      )}
    >
      {children}
    </div>
  );
}
