"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Crown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useSubscription } from "@/hooks/use-subscription";

const DEFAULT_EXCLUDED = ["/dashboard/configuracoes"];

interface SubscriptionGuardProps {
  children: React.ReactNode;
  excludePaths?: string[];
}

export default function SubscriptionGuard({ children, excludePaths }: SubscriptionGuardProps) {
  const sub = useSubscription();
  const pathname = usePathname();

  const excluded = excludePaths ?? DEFAULT_EXCLUDED;
  const isExcluded = excluded.some((p) => pathname === p || pathname?.startsWith(p + "?") || pathname?.startsWith(p + "/"));

  if (sub.loading) {
    return null;
  }

  const shouldBlock =
    !isExcluded && (
      sub.is_expired ||
      (sub.is_trial && (sub.days_remaining ?? 0) <= 0) ||
      (!sub.is_valid && !sub.is_trial)
    );

  return (
    <div className="relative">
      <div className={shouldBlock ? "blur-sm pointer-events-none select-none" : ""}>
        {children}
      </div>

      <AnimatePresence>
        {shouldBlock && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
            >
              <Card className="w-[90vw] max-w-md border-amber-200 bg-white shadow-2xl dark:border-amber-800 dark:bg-gray-950">
                <CardHeader className="items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                    <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                  </div>
                  <CardTitle className="text-xl font-bold text-foreground">
                    Sua assinatura expirou!
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Renove para continuar usando o LUCRIO
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2 text-sm text-muted-foreground">
                    <Crown className="h-4 w-4 text-emerald-600" />
                    <span>Plano atual: <strong>{sub.plan_name}</strong></span>
                  </div>
                  <Button asChild size="lg" className="w-full bg-emerald-600 text-white hover:bg-emerald-700">
                    <Link href="/dashboard/configuracoes?tab=assinatura">
                      Renovar Agora
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}