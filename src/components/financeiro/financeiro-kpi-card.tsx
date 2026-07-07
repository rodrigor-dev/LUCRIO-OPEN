import { Card, CardContent } from "@/components/ui/card";
import { formatarMoeda } from "@/utils";
import type { LucideIcon } from "lucide-react";

interface FinanceiroKpiCardProps {
  label: string;
  valor: number;
  qtd?: number;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  valorColor?: string;
}

export function FinanceiroKpiCard({
  label,
  valor,
  qtd,
  icon: Icon,
  iconColor,
  iconBg,
  valorColor,
}: FinanceiroKpiCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3.5 sm:p-4">
        <div className="flex items-center gap-2">
          <div className={`rounded-lg p-1.5 ${iconBg}`}>
            <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${iconColor}`} />
          </div>
          <span className="text-xs font-medium text-muted-foreground sm:text-xs">
            {label}
          </span>
        </div>
        <p className={`mt-2 text-lg font-bold sm:text-xl ${valorColor || "text-foreground"}`}>
          {formatarMoeda(valor)}
        </p>
        {qtd !== undefined && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {qtd} {qtd === 1 ? "registro" : "registros"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
