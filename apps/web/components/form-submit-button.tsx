"use client";

import { useFormStatus } from "react-dom";

type FormSubmitButtonProps = {
  idleLabel: string;
  pendingLabel: string;
  variant?: "primary" | "ghost" | "danger";
};

export function FormSubmitButton({ idleLabel, pendingLabel, variant = "primary" }: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={`button button--${variant}`} disabled={pending}>
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
