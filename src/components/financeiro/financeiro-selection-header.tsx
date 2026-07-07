import { Checkbox } from "@/components/ui/checkbox";
import { motion } from "framer-motion";

interface FinanceiroSelectionHeaderProps {
  total: number;
  selected: number;
  allSelected: boolean;
  onSelectAll: () => void;
}

export function FinanceiroSelectionHeader({
  total,
  selected,
  allSelected,
  onSelectAll,
}: FinanceiroSelectionHeaderProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <Checkbox
          checked={allSelected && total > 0}
          onCheckedChange={onSelectAll}
        />
        <span className="text-xs text-muted-foreground">
          {selected > 0
            ? `${selected} selecionada(s)`
            : "Selecionar todas"}
        </span>
      </div>
      <span className="text-xs text-muted-foreground">
        {total} resultado(s)
      </span>
    </div>
  );
}
