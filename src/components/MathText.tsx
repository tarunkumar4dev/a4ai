// src/components/MathText.tsx
// ──────────────────────────────────────────────────────────────────────
// Renders LaTeX-style math notation as proper HTML.
// Converts $x^2$ → x², $H_2O$ → H₂O, $\frac{a}{b}$ → a/b, etc.
// No external dependencies — pure regex-based rendering.
// ──────────────────────────────────────────────────────────────────────

import React from "react";

/**
 * Convert a LaTeX string to an array of React elements with proper
 * superscripts, subscripts, fractions, Greek letters, and symbols.
 */
function latexToElements(text: string): React.ReactNode[] {
  if (!text) return [];

  const elements: React.ReactNode[] = [];
  let key = 0;

  // Split on $...$ delimiters
  const parts = text.split(/(\$[^$]+?\$)/g);

  for (const part of parts) {
    if (part.startsWith("$") && part.endsWith("$")) {
      // Math content — render with formatting
      const math = part.slice(1, -1);
      elements.push(
        <span key={key++} className="math-inline">
          {renderMath(math, key)}
        </span>
      );
    } else {
      // Regular text
      elements.push(<span key={key++}>{part}</span>);
    }
  }

  return elements;
}

function renderMath(tex: string, baseKey: number): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let key = baseKey * 1000;
  let remaining = tex;

  while (remaining.length > 0) {
    let matched = false;

    // ── Fractions: \frac{a}{b} → a⁄b ──────────────────────────────
    const fracMatch = remaining.match(/^\\frac\{([^}]*)\}\{([^}]*)\}/);
    if (fracMatch) {
      nodes.push(
        <span key={key++} className="inline-flex flex-col items-center mx-0.5 align-middle text-[0.75em] leading-tight">
          <span className="border-b border-current px-0.5">{renderMath(fracMatch[1], key)}</span>
          <span className="px-0.5">{renderMath(fracMatch[2], key + 100)}</span>
        </span>
      );
      remaining = remaining.slice(fracMatch[0].length);
      matched = true;
    }

    // ── Square root: \sqrt{x} → √x ────────────────────────────────
    if (!matched) {
      const sqrtMatch = remaining.match(/^\\sqrt\{([^}]*)\}/);
      if (sqrtMatch) {
        nodes.push(<span key={key++}>√({renderMath(sqrtMatch[1], key)})</span>);
        remaining = remaining.slice(sqrtMatch[0].length);
        matched = true;
      }
    }

    // ── Superscript: ^{...} or ^x ─────────────────────────────────
    if (!matched) {
      const supBrace = remaining.match(/^\^\{([^}]*)\}/);
      const supSingle = remaining.match(/^\^([a-zA-Z0-9])/);
      if (supBrace) {
        nodes.push(<sup key={key++}>{renderMath(supBrace[1], key)}</sup>);
        remaining = remaining.slice(supBrace[0].length);
        matched = true;
      } else if (supSingle) {
        nodes.push(<sup key={key++}>{supSingle[1]}</sup>);
        remaining = remaining.slice(supSingle[0].length);
        matched = true;
      }
    }

    // ── Subscript: _{...} or _x ───────────────────────────────────
    if (!matched) {
      const subBrace = remaining.match(/^_\{([^}]*)\}/);
      const subSingle = remaining.match(/^_([a-zA-Z0-9])/);
      if (subBrace) {
        nodes.push(<sub key={key++}>{renderMath(subBrace[1], key)}</sub>);
        remaining = remaining.slice(subBrace[0].length);
        matched = true;
      } else if (subSingle) {
        nodes.push(<sub key={key++}>{subSingle[1]}</sub>);
        remaining = remaining.slice(subSingle[0].length);
        matched = true;
      }
    }

    // ── Greek letters and symbols ─────────────────────────────────
    if (!matched) {
      const symbolMap: Record<string, string> = {
        "\\alpha": "α", "\\beta": "β", "\\gamma": "γ", "\\delta": "δ",
        "\\epsilon": "ε", "\\theta": "θ", "\\lambda": "λ", "\\mu": "μ",
        "\\pi": "π", "\\sigma": "σ", "\\omega": "ω", "\\Omega": "Ω",
        "\\phi": "φ", "\\psi": "ψ", "\\rho": "ρ", "\\tau": "τ",
        "\\times": "×", "\\div": "÷", "\\pm": "±", "\\mp": "∓",
        "\\leq": "≤", "\\geq": "≥", "\\neq": "≠", "\\approx": "≈",
        "\\infty": "∞", "\\therefore": "∴", "\\because": "∵",
        "\\rightarrow": "→", "\\leftarrow": "←", "\\Rightarrow": "⇒",
        "\\degree": "°", "\\circ": "°",
        "\\sin": "sin", "\\cos": "cos", "\\tan": "tan",
        "\\log": "log", "\\ln": "ln", "\\sum": "Σ", "\\prod": "Π",
        "\\Delta": "Δ", "\\nabla": "∇",
        "\\text": "", "\\mathrm": "", "\\mathbf": "",
      };

      let foundSymbol = false;
      for (const [cmd, symbol] of Object.entries(symbolMap)) {
        if (remaining.startsWith(cmd)) {
          // Check it's not part of a longer command
          const after = remaining[cmd.length];
          if (!after || !/[a-zA-Z]/.test(after)) {
            nodes.push(<span key={key++}>{symbol}</span>);
            remaining = remaining.slice(cmd.length);
            foundSymbol = true;
            break;
          }
        }
      }
      if (foundSymbol) matched = true;
    }

    // ── \text{...} — render as plain text ─────────────────────────
    if (!matched) {
      const textMatch = remaining.match(/^\\(?:text|mathrm|mathbf)\{([^}]*)\}/);
      if (textMatch) {
        nodes.push(<span key={key++}>{textMatch[1]}</span>);
        remaining = remaining.slice(textMatch[0].length);
        matched = true;
      }
    }

    // ── Skip unknown backslash commands ───────────────────────────
    if (!matched) {
      const unknownCmd = remaining.match(/^\\([a-zA-Z]+)/);
      if (unknownCmd) {
        // Just render the command name without backslash
        nodes.push(<span key={key++}>{unknownCmd[1]}</span>);
        remaining = remaining.slice(unknownCmd[0].length);
        matched = true;
      }
    }

    // ── Skip braces ──────────────────────────────────────────────
    if (!matched && (remaining[0] === "{" || remaining[0] === "}")) {
      remaining = remaining.slice(1);
      matched = true;
    }

    // ── Regular character ────────────────────────────────────────
    if (!matched) {
      nodes.push(<span key={key++}>{remaining[0]}</span>);
      remaining = remaining.slice(1);
    }
  }

  return nodes;
}

// ── Public Component ───────────────────────────────────────────────────

interface MathTextProps {
  text: string;
  className?: string;
}

const MathText: React.FC<MathTextProps> = ({ text, className }) => {
  if (!text) return null;

  // If no $ delimiters, return plain text
  if (!text.includes("$")) {
    return <span className={className}>{text}</span>;
  }

  return <span className={className}>{latexToElements(text)}</span>;
};

export default MathText;