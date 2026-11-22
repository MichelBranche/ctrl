/*
 * Data-status atoms on the public tokens: stage badge, score meter, due chip, tone avatar.
 * Colour carries meaning (stage, score level, overdue), never decoration. Styles: components/ds/status.css.
 */
import type { ReactNode } from "react";

export const TONES = 8;
/** Stable 1–8 tone for a label (category, owner name). Same input, same colour, on every page. */
export const toneOf = (label: string | null | undefined) => {
  let hash = 0;
  for (const ch of (label ?? "").trim().toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (hash % TONES) + 1;
};

export type ScoreLevel = "alto" | "medio" | "basso";
export const scoreLevel = (score: number): ScoreLevel => (score >= 70 ? "alto" : score >= 40 ? "medio" : "basso");

/** Coloured dot + label. `stage` picks --ds-stage-<stage>. */
export function StageBadge({ stage, label, children }: { stage: string; label: string; children?: ReactNode }) {
  return <span className="ds-stage" data-stage={stage}><i aria-hidden="true" />{label}{children}</span>;
}

/** 0–100 as a short bar plus the number. Null reads "n/d" in muted text. */
export function ScoreMeter({ score, compact = false }: { score: number | null; compact?: boolean }) {
  if (score === null) return <span className="ds-score" data-level="none" title="Punteggio non disponibile"><span className="ds-score-n">n/d</span></span>;
  const level = scoreLevel(score);
  return (
    <span className="ds-score" data-level={level} data-compact={compact ? "" : undefined} title={`Punteggio ${score} su 100`}>
      <span className="ds-score-bar" aria-hidden="true"><span style={{ width: `${Math.max(4, Math.min(100, score))}%` }} /></span>
      <span className="ds-score-n">{score}</span>
    </span>
  );
}

/** Relative due date: red when overdue, amber today, neutral later. */
export function DueChip({ label, overdue, today }: { label: string; overdue: boolean; today?: boolean }) {
  return <span className="ds-due" data-state={overdue ? "late" : today ? "today" : "later"}>{label}</span>;
}

/** Initials on a category tone. */
export function ToneAvatar({ letters, tone, size = "md" }: { letters: string; tone: number; size?: "sm" | "md" | "lg" }) {
  return <span className="ds-avatar" data-tone={tone} data-size={size} aria-hidden="true">{letters}</span>;
}
