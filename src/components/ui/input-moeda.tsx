"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { formatarInputMoeda, parseMoeda } from "@/utils";

interface InputMoedaProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function InputMoeda({ value, onChange, placeholder = "R$ 0,00", disabled, className, id }: InputMoedaProps) {
  const [displayValue, setDisplayValue] = useState(
    value > 0 ? value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const formatado = formatarInputMoeda(e.target.value);
    setDisplayValue(formatado);
    const parsed = parseMoeda(formatado);
    onChange(parsed);
  }, [onChange]);

  const handleBlur = useCallback(() => {
    if (value > 0) {
      setDisplayValue(value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
  }, [value]);

  return (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  );
}
