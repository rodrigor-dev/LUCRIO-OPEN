"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LandingContent } from "@/components/landing-content";

export default function Home() {
  const router = useRouter();
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    async function verificarSessao() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        router.replace("/dashboard");
        return;
      }

      if (localStorage.getItem("faturion_dispositivo_logado") === "true") {
        router.replace("/login");
        return;
      }

      setVerificando(false);
    }

    verificarSessao();
  }, [router]);

  if (verificando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return <LandingContent />;
}
