import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const rotasPublicasExatas = [
    "/",
    "/login",
    "/cadastro",
    "/recuperar-senha",
    "/redefinir-senha",
  ];

  const rotasPublicasComPrefixo = [
    "/auth/callback",
    "/auth/confirm",
  ];

  const ehRotaExataPublica = rotasPublicasExatas.includes(pathname);
  const ehRotaComPrefixoPublico = rotasPublicasComPrefixo.some((rota) =>
    pathname.startsWith(rota)
  );
  const rotaPublica = ehRotaExataPublica || ehRotaComPrefixoPublico;

  // Rotas não-autenticadas redirecionam para login
  if (!user && !rotaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Usuário logado não acessa login/cadastro
  if (user && (pathname === "/login" || pathname === "/cadastro")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Verificação de admin para rotas /admin/*
  if (pathname.startsWith("/admin")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }

    // Query robusta: tenta is_admin com fallback seguro
    try {
      const { data: usuario, error } = await supabase
        .from("usuarios")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      // Se houve erro na query ou usuário não existe ou não é admin
      if (error || !usuario || usuario.is_admin !== true) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    } catch {
      // Em caso de qualquer exceção, negar acesso
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
