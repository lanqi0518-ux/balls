"use client";

import { useState, useMemo, ReactNode } from "react";
import { Check } from "@/components/ui/Icons";
import { cn } from "@/lib/cn";

type Lang = "solidity" | "typescript" | "tsx" | "javascript" | "bash" | "json" | "text";

interface Props {
  code: string;
  lang?: Lang;
  filename?: string;
  showLines?: boolean;
  className?: string;
  meta?: ReactNode;
}

/**
 * A zero-dependency code block with copy-button, filename tab, optional
 * line numbers, and a tiny regex-based syntax highlighter for Solidity,
 * TS/JS/TSX, bash and JSON.
 *
 * We roll our own instead of shipping ~180KB of Prism / Shiki because
 * every doc page loads at 320KB First-Load JS already and the design
 * calls for a very specific dark-terminal aesthetic.
 */
export function CodeBlock({
  code,
  lang = "text",
  filename,
  showLines = false,
  className,
  meta,
}: Props) {
  const [copied, setCopied] = useState(false);

  const trimmed = code.replace(/^\n+|\s+$/g, "");
  const lines = trimmed.split("\n");
  const html = useMemo(() => highlight(trimmed, lang), [trimmed, lang]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(trimmed);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  }

  return (
    <div
      className={cn(
        "not-prose group my-6 rounded-2xl overflow-hidden border border-line-strong bg-ink-900 text-ink-100",
        className
      )}
    >
      {(filename || lang !== "text" || meta) && (
        <div className="flex items-center justify-between px-4 h-10 border-b border-white/5 bg-black/25 text-xs font-mono">
          <div className="flex items-center gap-3 min-w-0 truncate">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
            </div>
            {filename && (
              <span className="text-ink-100 truncate">{filename}</span>
            )}
            {!filename && lang !== "text" && (
              <span className="text-ink-100/60 uppercase tracking-[0.14em]">
                {lang}
              </span>
            )}
            {meta && (
              <span className="text-ink-100/60 truncate">{meta}</span>
            )}
          </div>
          <button
            onClick={copy}
            className={cn(
              "flex items-center gap-1.5 h-6 px-2 rounded-md text-[11px] transition-colors",
              copied
                ? "bg-forest-500/20 text-forest-300"
                : "text-ink-100/60 hover:text-ink-100 hover:bg-white/5"
            )}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                Copied
              </>
            ) : (
              <>
                <CopyIcon className="h-3 w-3" />
                Copy
              </>
            )}
          </button>
        </div>
      )}

      <div className="relative overflow-x-auto">
        <pre className="text-[13px] leading-[1.65] p-5 font-mono">
          <code className="block">
            {showLines ? (
              <table className="border-collapse">
                <tbody>
                  {lines.map((line, i) => {
                    const html_i = highlight(line, lang);
                    return (
                      <tr key={i}>
                        <td className="pr-4 text-right text-ink-100/25 select-none font-mono text-[11px] w-8 align-top">
                          {i + 1}
                        </td>
                        <td
                          className="whitespace-pre"
                          dangerouslySetInnerHTML={{ __html: html_i || "&nbsp;" }}
                        />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <span dangerouslySetInnerHTML={{ __html: html }} />
            )}
          </code>
        </pre>

        {!filename && lang === "text" && (
          <button
            onClick={copy}
            aria-label="Copy code"
            className={cn(
              "absolute top-3 right-3 flex items-center gap-1.5 h-6 px-2 rounded-md text-[11px] transition-all",
              "opacity-0 group-hover:opacity-100",
              copied
                ? "bg-forest-500/20 text-forest-300"
                : "bg-white/5 text-ink-100/60 hover:text-ink-100 hover:bg-white/10"
            )}
          >
            {copied ? (
              <Check className="h-3 w-3" />
            ) : (
              <CopyIcon className="h-3 w-3" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

// -------- highlighter --------

const ESC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ESC[c]);

const KW_SOL = new Set([
  "pragma", "solidity", "contract", "interface", "library", "abstract",
  "function", "constructor", "modifier", "event", "struct", "enum",
  "public", "external", "internal", "private", "pure", "view", "payable",
  "returns", "return", "if", "else", "for", "while", "do", "break",
  "continue", "revert", "require", "assert", "emit", "new", "delete",
  "using", "is", "as", "type", "override", "virtual", "immutable",
  "constant", "storage", "memory", "calldata", "unchecked", "assembly",
  "try", "catch", "import", "from", "true", "false",
]);

const TYPE_SOL = new Set([
  "uint", "uint8", "uint16", "uint32", "uint64", "uint128", "uint256",
  "int", "int8", "int16", "int32", "int64", "int128", "int256",
  "address", "bool", "bytes", "bytes32", "bytes4", "string", "mapping",
  "IERC20", "IERC721", "IERC1155",
]);

const KW_TS = new Set([
  "import", "from", "export", "default", "const", "let", "var",
  "function", "return", "if", "else", "for", "while", "do", "break",
  "continue", "throw", "try", "catch", "finally", "new", "class",
  "extends", "implements", "interface", "type", "enum", "async",
  "await", "yield", "typeof", "instanceof", "in", "of", "as",
  "public", "private", "protected", "readonly", "static", "abstract",
  "true", "false", "null", "undefined", "this", "super",
]);

const KW_BASH = new Set([
  "if", "then", "fi", "else", "elif", "for", "in", "do", "done",
  "while", "case", "esac", "function", "return", "export", "source",
  "sudo", "cd", "ls", "rm", "cp", "mv", "cat", "echo", "grep", "sed",
  "awk", "curl", "wget", "npm", "pnpm", "yarn", "npx", "docker",
  "forge", "cast", "anvil", "git",
]);

function highlight(src: string, lang: Lang): string {
  if (lang === "text") return esc(src);

  const tokens: Array<[string, string]> = []; // [class, text]

  // Choose patterns per lang. Very simple state machine — process the string
  // greedily from left to right, longest-match-first.
  const rules = getRules(lang);
  let i = 0;
  while (i < src.length) {
    let matched: { cls: string; len: number } | null = null;
    for (const r of rules) {
      r.re.lastIndex = i;
      const m = r.re.exec(src);
      if (m && m.index === i) {
        if (!matched || m[0].length > matched.len) {
          matched = { cls: r.cls, len: m[0].length };
        }
      }
    }
    if (matched) {
      const text = src.slice(i, i + matched.len);
      // Keyword vs identifier disambiguation for word-classes
      if (matched.cls === "kw-check") {
        const kwSet =
          lang === "solidity"
            ? KW_SOL
            : lang === "typescript" || lang === "tsx" || lang === "javascript"
            ? KW_TS
            : lang === "bash"
            ? KW_BASH
            : new Set<string>();
        const typeSet = lang === "solidity" ? TYPE_SOL : new Set<string>();
        const cls = kwSet.has(text)
          ? "hl-kw"
          : typeSet.has(text) || /^u?int\d*$|^bytes\d*$/.test(text)
          ? "hl-type"
          : "hl-id";
        tokens.push([cls, esc(text)]);
      } else {
        tokens.push([matched.cls, esc(text)]);
      }
      i += matched.len;
    } else {
      tokens.push(["hl-plain", esc(src[i])]);
      i += 1;
    }
  }

  return tokens
    .map(([cls, txt]) =>
      cls === "hl-plain" ? txt : `<span class="${cls}">${txt}</span>`
    )
    .join("");
}

function getRules(lang: Lang): Array<{ cls: string; re: RegExp }> {
  const base = [
    { cls: "hl-com", re: /\/\/[^\n]*/g },
    { cls: "hl-com", re: /\/\*[\s\S]*?\*\//g },
    { cls: "hl-str", re: /"(?:\\.|[^"\\])*"/g },
    { cls: "hl-str", re: /'(?:\\.|[^'\\])*'/g },
    { cls: "hl-str", re: /`(?:\\.|[^`\\])*`/g },
    { cls: "hl-num", re: /\b0x[0-9a-fA-F_]+n?\b/g },
    { cls: "hl-num", re: /\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?n?\b/g },
    { cls: "hl-kw-check", re: /\b[A-Za-z_$][\w$]*\b/g },
    { cls: "hl-op", re: /[+\-*/%=<>!&|^~?:]+/g },
  ];
  if (lang === "solidity") {
    return [
      { cls: "hl-com", re: /\/\/[^\n]*/g },
      { cls: "hl-com", re: /\/\*[\s\S]*?\*\//g },
      { cls: "hl-str", re: /"(?:\\.|[^"\\])*"/g },
      { cls: "hl-str", re: /'(?:\\.|[^'\\])*'/g },
      { cls: "hl-num", re: /\b\d[\d_]*(?:\.\d+)?(?:e\d+)?\b/g },
      { cls: "hl-kw-check", re: /\b[A-Za-z_$][\w$]*\b/g },
      { cls: "hl-op", re: /[+\-*/%=<>!&|^~?:]+/g },
    ];
  }
  if (lang === "bash") {
    return [
      { cls: "hl-com", re: /#[^\n]*/g },
      { cls: "hl-str", re: /"(?:\\.|[^"\\])*"/g },
      { cls: "hl-str", re: /'(?:\\.|[^'\\])*'/g },
      { cls: "hl-var", re: /\$[A-Za-z_][\w]*/g },
      { cls: "hl-kw-check", re: /\b[A-Za-z_][\w-]*\b/g },
      { cls: "hl-num", re: /\b\d+\b/g },
      { cls: "hl-op", re: /[|<>&;]+/g },
    ];
  }
  if (lang === "json") {
    return [
      { cls: "hl-str", re: /"(?:\\.|[^"\\])*"(?=\s*:)/g },
      { cls: "hl-val", re: /"(?:\\.|[^"\\])*"/g },
      { cls: "hl-num", re: /-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g },
      { cls: "hl-kw-check", re: /\b(?:true|false|null)\b/g },
      { cls: "hl-op", re: /[{}[\]:,]/g },
    ];
  }
  return base;
}
