"use client";

import { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS, STATUS_VARIANTS } from "@/lib/constants";

interface MobileCardColumn {
  key: string;
  label: string;
  className?: string;
}

interface MobileCardAction {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  variant?: "ghost" | "destructive";
}

interface MobileCardBadge {
  label: string;
  variant?: "default" | "secondary" | "destructive" | "outline";
  style?: React.CSSProperties;
  icon?: string;
}

interface MobileCardProps {
  id: string;
  title: string;
  subtitle?: string;
  value?: string;
  valueColor?: string;
  valuePrefix?: string;
  statusKey?: string;
  badges?: MobileCardBadge[];
  columns?: MobileCardColumn[];
  actions?: MobileCardAction[];
  index?: number;
}

export function MobileCard({
  id,
  title,
  subtitle,
  value,
  valueColor = "text-green-600",
  valuePrefix = "",
  statusKey,
  badges = [],
  columns = [],
  actions = [],
  index = 0,
}: MobileCardProps) {
  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-lg border bg-card p-4 shadow-sm"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1 min-w-0 flex-1">
          <p className="font-medium truncate">{title}</p>
          {subtitle && (
            <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
          )}
          {columns.map((col) => (
            <p key={col.key} className={`text-sm text-muted-foreground ${col.className || ""}`}>
              {col.label}
            </p>
          ))}
        </div>
        {value && (
          <p className={`text-lg font-bold ml-2 shrink-0 ${valueColor}`}>
            {valuePrefix}{value}
          </p>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {statusKey && (
            <Badge variant={STATUS_VARIANTS[statusKey] || "outline"}>
              {STATUS_LABELS[statusKey] || statusKey}
            </Badge>
          )}
          {badges.map((badge, i) => (
            <Badge
              key={i}
              variant={badge.variant || "outline"}
              className="gap-1"
              style={badge.style}
            >
              {badge.icon && <span>{badge.icon}</span>}
              {badge.label}
            </Badge>
          ))}
        </div>
        <div className="flex gap-1">
          {actions.map((action, i) => (
            <Button
              key={i}
              variant="ghost"
              size="icon"
              className={`h-11 w-11 ${action.variant === "destructive" ? "text-destructive hover:text-destructive" : ""}`}
              onClick={action.onClick}
              title={action.label}
            >
              {action.icon}
            </Button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

interface MobileCardListProps {
  children: React.ReactNode;
}

export function MobileCardList({ children }: MobileCardListProps) {
  return (
    <div className="grid gap-3 md:hidden">
      <AnimatePresence>
        {children}
      </AnimatePresence>
    </div>
  );
}
