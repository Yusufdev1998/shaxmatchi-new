import * as React from "react";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export function Button({ variant = "primary", style, ...props }: ButtonProps) {
  const base: React.CSSProperties = {
    borderRadius: 10,
    padding: "10px 14px",
    border: "1px solid transparent",
    cursor: "pointer",
    fontWeight: 600
  };

  const variants: Record<NonNullable<ButtonProps["variant"]>, React.CSSProperties> = {
    primary: { background: "#111827", color: "white" },
    secondary: { background: "white", color: "#111827", borderColor: "#E5E7EB" }
  };

  return <button {...props} style={{ ...base, ...variants[variant], ...style }} />;
}

