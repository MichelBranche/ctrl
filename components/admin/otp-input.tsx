"use client";

import { OTPInput, REGEXP_ONLY_DIGITS, type SlotProps } from "input-otp";
import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import { useEffect } from "react";

export type OtpStatus = "idle" | "error" | "success";

/**
 * 6-slot one-time-code field (input-otp, the primitive behind shadcn InputOTP). One real <input> underneath:
 * autocomplete=one-time-code (SMS/keychain autofill), numeric keypad, paste of the whole code. Calls onComplete
 * when the 6th digit lands. Motion: digits pop in, active slot ring + caret, error shake, success stagger to green.
 * Reduced motion: same colours, no movement.
 */
export function OtpInput({ name, value, onChange, onComplete, status, errorKey, disabled, autoFocus, label }: {
  name: string; value: string; onChange: (v: string) => void; onComplete?: (v: string) => void;
  status: OtpStatus; errorKey: number; disabled?: boolean; autoFocus?: boolean; label: string;
}) {
  const reduce = useReducedMotion();
  const shake = useAnimationControls();
  useEffect(() => {
    if (status === "error" && errorKey > 0 && !reduce) void shake.start({ x: [0, -9, 8, -6, 4, -2, 0], transition: { duration: 0.42, ease: "easeOut" } });
  }, [status, errorKey, reduce, shake]);
  return (
    <motion.div animate={shake} className="adm-otp-wrap">
      <OTPInput
        name={name}
        maxLength={6}
        value={value}
        onChange={onChange}
        onComplete={onComplete}
        pattern={REGEXP_ONLY_DIGITS}
        inputMode="numeric"
        autoComplete="one-time-code"
        disabled={disabled}
        autoFocus={autoFocus}
        aria-label={label}
        aria-invalid={status === "error" || undefined}
        containerClassName={`adm-otp adm-otp-${status}`}
        render={({ slots }) => (
          <>
            <div className="adm-otp-group">{slots.slice(0, 3).map((s, i) => <Slot key={i} i={i} {...s} status={status} reduce={Boolean(reduce)} />)}</div>
            <span className="adm-otp-sep" aria-hidden="true" />
            <div className="adm-otp-group">{slots.slice(3).map((s, i) => <Slot key={i + 3} i={i + 3} {...s} status={status} reduce={Boolean(reduce)} />)}</div>
          </>
        )}
      />
    </motion.div>
  );
}

function Slot({ char, isActive, hasFakeCaret, status, i, reduce }: SlotProps & { status: OtpStatus; i: number; reduce: boolean }) {
  const success = status === "success";
  return (
    <motion.div
      className={`adm-otp-slot${isActive ? " is-active" : ""}${char ? " is-filled" : ""}`}
      animate={success && !reduce ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={{ delay: success ? i * 0.05 : 0, duration: 0.3 }}
      data-status={status}
      style={success ? { transitionDelay: `${i * 50}ms` } : undefined}
    >
      {char ? (
        <motion.span key={char + i} initial={reduce ? false : { scale: 0.4, opacity: 0, y: 4 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 520, damping: 24 }}>
          {char}
        </motion.span>
      ) : null}
      {hasFakeCaret ? <span className="adm-otp-caret" aria-hidden="true" /> : null}
    </motion.div>
  );
}
