"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PasswordInput({
  value,
  onChange,
  id,
  autoComplete,
  placeholder,
  required = true,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const generated = useId();
  const inputId = id ?? generated;
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={inputId}
        type={visible ? "text" : "password"}
        className="input pe-12"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        minLength={8}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-muted"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
