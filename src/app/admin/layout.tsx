"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AdminSidebar, { AdminMobileSidebar } from "@/components/admin/admin-sidebar";
import AdminTopbar from "@/components/admin/admin-topbar";
import CommandPalette from "@/components/command-palette";
import type { Usuario } from "@/types/database";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const supabase = createClient();

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: usuarioData } = await supabase
        .from("usuarios")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!usuarioData || !usuarioData.is_admin) {
        router.push("/dashboard");
        return;
      }

      setUsuario(usuarioData);
      setAuthorized(true);
      setLoading(false);
    }

    loadUser();
  }, [supabase, router]);

  const userInitials = usuario?.nome
    ? usuario.nome
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "AD";

  if (loading || !authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <AdminSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        userInitials={userInitials}
      />

      {/* Mobile Sidebar */}
      <AdminMobileSidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        userInitials={userInitials}
      />

      {/* Main Area */}
      <div
        className={`flex flex-1 flex-col transition-all duration-300 ${
          sidebarCollapsed ? "lg:ml-[68px]" : "lg:ml-[250px]"
        }`}
      >
        <AdminTopbar
          userInitials={userInitials}
          userName={usuario?.nome}
          userEmail={usuario?.email}
          onMobileMenuToggle={() => setMobileOpen(!mobileOpen)}
        />

        <main
          id="main-content"
          role="main"
          aria-label="Conteudo administrativo"
          className="flex-1 p-4 pb-24 lg:p-6 lg:pb-6"
        >
          {children}
        </main>
      </div>

      <CommandPalette />
    </div>
  );
}
