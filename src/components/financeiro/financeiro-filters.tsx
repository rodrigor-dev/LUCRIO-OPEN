import { X } from "lucide-react";

interface FilterOption {
  label: string;
  value: string;
  count?: number;
  color?: string;
}

interface FinanceiroFilterBarProps {
  filters: FilterOption[];
  activeValue: string;
  onSelect: (value: string) => void;
}

export function FinanceiroFilterBar({
  filters,
  activeValue,
  onSelect,
}: FinanceiroFilterBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => {
        // Itens divisores (ex: { value: "__divider__" }) são apenas um
        // separador visual, nunca um botão clicável.
        if (filter.value === "__divider__") {
          return (
            <div
              key="divider"
              aria-hidden="true"
              className="mx-0.5 hidden h-8 w-px shrink-0 self-center bg-border sm:block"
            />
          );
        }

        const isActive = activeValue === filter.value;
        return (
          <button
            key={filter.value}
            onClick={() => onSelect(filter.value)}
            className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors whitespace-nowrap ${
              isActive
                ? filter.color || "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            {filter.label}
            {filter.count !== undefined && (
              <span className="opacity-70">({filter.count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface FinanceiroSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function FinanceiroSearch({
  value,
  onChange,
  placeholder = "Buscar...",
}: FinanceiroSearchProps) {
  return (
    <div className="relative">
      <svg
        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
        />
      </svg>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border bg-card pl-10 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/20"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
