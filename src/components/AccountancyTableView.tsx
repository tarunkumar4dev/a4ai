/**
 * AccountancyTableView — CBSE-style financial tables for the Test Builder preview.
 * Mirrors the PDF exporter (_render_acc_structured_table_pdf): grey header, dark rules,
 * right-aligned tabular amounts, single rule above / double rule below totals, spanning
 * section rows, T-account layout with inner working columns.
 */
import React, { useState } from "react";
import type { AccSegment, AccTable } from "@/utils/accountancyTables";
import { inferTableMeta } from "@/utils/accountancyTables";

const RULE = "#374151";

function renderCell(text: string): React.ReactNode {
  const parts = String(text ?? "").split(/(\*\*.+?\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <React.Fragment key={i}>{p}</React.Fragment>
  );
}

/** Header cells; a blank header (inner working column) merges into the title on its left. */
function headerCells(headers: string[]): { text: string; span: number; col: number }[] {
  const out: { text: string; span: number; col: number }[] = [];
  headers.forEach((h, c) => {
    if (c > 0 && !h.trim() && out.length) out[out.length - 1].span += 1;
    else out.push({ text: h, span: 1, col: c });
  });
  return out;
}

export function AccountancyTableView({ table, maxRows }: { table: AccTable; maxRows?: number }) {
  const [expanded, setExpanded] = useState(false);
  const t = inferTableMeta(table);
  const ncol = t.headers.length;
  if (!ncol || !t.rows.length) return null;

  const amountCols = new Set(t.amount_cols || []);
  const totalRows = new Set(t.total_rows || []);
  const sectionRows = new Set(t.section_rows || []);
  const accountStyle = t.kind === "t_account" || t.kind === "ledger";
  const mid = t.kind === "t_account" ? ncol / 2 - 1 : -1;
  const innerCol = (c: number) => c > 0 && !t.headers[c].trim();
  const fullWidth = accountStyle || ncol >= 4 || t.kind === "pipe" || t.kind === "dated" || t.kind === "trial_balance";

  const limit = maxRows && !expanded ? maxRows : t.rows.length;
  const rows = t.rows.slice(0, limit);
  const hidden = t.rows.length - rows.length;

  const cellStyle = (c: number, isTotal: boolean, hasValue: boolean): React.CSSProperties => {
    const s: React.CSSProperties = {
      borderLeft: c === 0 || innerCol(c) ? undefined : `1px solid ${RULE}`,
      borderRight: c === mid ? `2px solid ${RULE}` : undefined,
    };
    if (!accountStyle) s.borderBottom = `1px solid ${RULE}`;
    if (isTotal && amountCols.has(c) && hasValue) {
      s.borderTop = `1px solid ${RULE}`;
      s.borderBottom = `3px double ${RULE}`;
    }
    return s;
  };

  return (
    <div className="my-2.5">
      {t.caption && <div className="text-center text-[11px] font-bold text-gray-800 mb-1">{renderCell(t.caption)}</div>}
      <div className="overflow-x-auto">
        <table
          className={`${fullWidth ? "w-full" : "w-full sm:w-auto sm:min-w-[62%]"} mx-auto text-[11px] leading-snug text-gray-900 border-collapse tabular-nums`}
          style={{ border: `1px solid ${RULE}` }}
        >
          <thead>
            <tr style={{ background: "#F3F4F6", borderBottom: `1px solid ${RULE}` }}>
              {headerCells(t.headers).map((h) => (
                <th
                  key={h.col}
                  colSpan={h.span}
                  className="px-2 py-1.5 text-center font-semibold whitespace-nowrap"
                  style={{
                    borderLeft: h.col === 0 ? undefined : `1px solid ${RULE}`,
                    borderRight: h.col + h.span - 1 === mid ? `2px solid ${RULE}` : undefined,
                  }}
                >
                  {renderCell(h.text)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => {
              if (sectionRows.has(r)) {
                return (
                  <tr key={r} className="bg-gray-50">
                    <td colSpan={ncol} className="px-2 py-1 font-semibold" style={{ borderBottom: accountStyle ? undefined : `1px solid ${RULE}` }}>
                      {renderCell(row[0])}
                    </td>
                  </tr>
                );
              }
              const isTotal = totalRows.has(r);
              return (
                <tr key={r} className={isTotal ? "font-semibold" : undefined}>
                  {row.map((cell, c) => {
                    const amount = amountCols.has(c);
                    return (
                      <td
                        key={c}
                        className={`px-2 ${isTotal ? "pt-1 pb-1.5" : "py-1"} align-top ${
                          amount ? "text-right whitespace-nowrap" : "text-left"
                        } ${cell.startsWith("**") ? "font-semibold" : ""}`}
                        style={cellStyle(c, isTotal, !!cell.trim())}
                      >
                        {renderCell(cell)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {hidden > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(true);
          }}
          className="mt-1 text-[11px] font-medium text-blue-700 hover:underline"
        >
          Show all {t.rows.length} rows
        </button>
      )}
      {(t.sides_unknown || t.totals_verified === false) && (
        <p className="mt-1 text-[10px] text-amber-700">
          {t.sides_unknown
            ? "Dr./Cr. sides could not be recovered from the NCERT text — entries are in printed order. Review before using."
            : "Figures in the source text don't add up to the printed totals — please verify before using."}
        </p>
      )}
    </div>
  );
}

/** Text + table segments of one question, in printed order. */
export function AccountancySegments({
  segments,
  renderText,
  truncateAt,
  maxRows,
}: {
  segments: AccSegment[];
  renderText: (text: string) => React.ReactNode;
  truncateAt?: number;
  maxRows?: number;
}) {
  let budget = truncateAt ?? Infinity;
  return (
    <div className="space-y-1">
      {segments.map((seg, i) => {
        if (seg.type === "table") return <AccountancyTableView key={i} table={seg.table} maxRows={maxRows} />;
        if (budget <= 0) return null;
        let text = seg.content;
        if (text.length > budget) text = text.slice(0, budget) + "…";
        budget -= text.length;
        return (
          <div key={i} className="text-gray-900 text-sm leading-relaxed whitespace-pre-line">
            {renderText(text)}
          </div>
        );
      })}
    </div>
  );
}
