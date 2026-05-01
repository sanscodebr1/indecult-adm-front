import type { ReactNode } from "react";

type StatusBadgeProps = {
  tone?: "pending" | "success" | "danger" | "neutral" | "accent";
  children: ReactNode;
};

export function StatusBadge({ tone = "neutral", children }: StatusBadgeProps) {
  return (
    <span className="status-badge" data-tone={tone}>
      {children}
    </span>
  );
}
