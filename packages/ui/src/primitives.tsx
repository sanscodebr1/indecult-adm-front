import type { ButtonHTMLAttributes, CSSProperties, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      {children}
      {hint ? <small style={hintStyle}>{hint}</small> : null}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { style, ...rest } = props;

  return <input {...rest} style={{ ...inputStyle, ...style }} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { style, ...rest } = props;

  return <textarea {...rest} style={{ ...textareaStyle, ...style }} />;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ variant = "primary", style, ...props }: ButtonProps) {
  const variantStyle = variantStyles[variant];

  return (
    <button
      {...props}
      style={{
        ...buttonBaseStyle,
        ...variantStyle,
        ...style
      }}
    />
  );
}

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 10
};

const labelStyle: CSSProperties = {
  fontWeight: 700,
  color: "#16356b"
};

const hintStyle: CSSProperties = {
  color: "#5e6b86",
  lineHeight: 1.6
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: 54,
  padding: "0 16px",
  borderRadius: 16,
  border: "1px solid rgba(38, 66, 118, 0.16)",
  background: "#f7f9fd",
  color: "#16356b",
  outline: "none"
};

const textareaStyle: CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 16,
  border: "1px solid rgba(38, 66, 118, 0.16)",
  background: "#f7f9fd",
  color: "#16356b",
  minHeight: 148,
  resize: "vertical",
  outline: "none"
};

const buttonBaseStyle: CSSProperties = {
  minHeight: 54,
  padding: "0 22px",
  borderRadius: 16,
  border: "1px solid transparent",
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  cursor: "pointer"
};

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, CSSProperties> = {
  primary: {
    background: "#365594",
    color: "#ffffff",
    boxShadow: "0 16px 32px rgba(21, 43, 84, 0.16)"
  },
  secondary: {
    background: "#ffc32f",
    color: "#264276",
    boxShadow: "0 16px 32px rgba(255, 195, 47, 0.24)"
  },
  ghost: {
    background: "transparent",
    color: "#365594",
    borderColor: "rgba(54, 85, 148, 0.2)"
  }
};
