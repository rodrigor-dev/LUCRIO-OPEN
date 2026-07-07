import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface FinanceiroEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  hasFilters?: boolean;
}

export function FinanceiroEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  hasFilters,
}: FinanceiroEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border bg-card py-12">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Icon className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <h3 className="mb-1.5 text-base font-semibold">{title}</h3>
      <p className="mb-4 text-center text-sm text-muted-foreground">
        {hasFilters ? "Tente ajustar os filtros" : description}
      </p>
      {!hasFilters && actionLabel && onAction && (
        <Button onClick={onAction} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="mr-2 h-4 w-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
