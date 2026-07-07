import { STATUS_LABELS } from "@/lib/constants";

const STATUS_BADGE_COLORS: Record<string, string> = {
  pago: "bg-emerald-100 text-emerald-700 border-emerald-200",
  pendente: "bg-yellow-100 text-yellow-700 border-yellow-200",
  atrasado: "bg-red-100 text-red-700 border-red-200",
  cancelado: "bg-gray-100 text-gray-500 border-gray-200",
};

export function FinanceiroStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium sm:text-xs ${STATUS_BADGE_COLORS[status] || STATUS_BADGE_COLORS.pendente}`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export const STATUS_DOT_COLORS: Record<string, string> = {
  pago: "bg-emerald-500",
  pendente: "bg-yellow-500",
  atrasado: "bg-red-500",
  cancelado: "bg-gray-400",
};

export const VALUE_COLORS: Record<string, string> = {
  pago: "text-emerald-600",
  pendente: "text-foreground",
  atrasado: "text-red-600",
  cancelado: "text-muted-foreground",
};
