import { Button } from "@/components/ui/button";
import { CheckCheck, Clock, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FinanceiroBulkBarProps {
  count: number;
  onCancel: () => void;
  onMarkPaid: () => void;
  onMarkPending: () => void;
  onDelete: () => void;
  processing?: boolean;
}

export function FinanceiroBulkBar({
  count,
  onCancel,
  onMarkPaid,
  onMarkPending,
  onDelete,
  processing,
}: FinanceiroBulkBarProps) {
  if (count === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-0 left-0 right-0 z-40 border-t bg-card/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/80 md:hidden"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium">{count} selecionado(s)</span>
          <button onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground">
            Limpar
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-11 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
            onClick={onMarkPaid}
            disabled={processing}
          >
            <CheckCheck className="mr-1 h-4 w-4" />
            Pago
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-11 border-yellow-200 text-yellow-700 hover:bg-yellow-50 hover:text-yellow-800"
            onClick={onMarkPending}
            disabled={processing}
          >
            <Clock className="mr-1 h-4 w-4" />
            Pendente
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-11 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
            onClick={onDelete}
            disabled={processing}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Excluir
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export function FinanceiroBulkBarDesktop({
  count,
  onCancel,
  onMarkPaid,
  onMarkPending,
  onDelete,
  processing,
}: FinanceiroBulkBarProps) {
  if (count === 0) return null;

  return (
    <div className="hidden md:block">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <span className="text-xs font-medium text-emerald-800">
          {count} selecionado(s)
        </span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-8 border-emerald-300 bg-white px-2.5 text-xs text-emerald-700 hover:bg-emerald-100"
            onClick={onMarkPaid}
            disabled={processing}
          >
            <CheckCheck className="mr-1 h-3 w-3" />
            Pago
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 border-yellow-300 bg-white px-2.5 text-xs text-yellow-700 hover:bg-yellow-50"
            onClick={onMarkPending}
            disabled={processing}
          >
            <Clock className="mr-1 h-3 w-3" />
            Pendente
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 border-red-300 bg-white px-2.5 text-xs text-red-700 hover:bg-red-50"
            onClick={onDelete}
            disabled={processing}
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Excluir
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 px-0"
            onClick={onCancel}
          >
            ✕
          </Button>
        </div>
      </div>
    </div>
  );
}
