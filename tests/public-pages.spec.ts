import { test, expect } from "@playwright/test";

test.describe("Páginas Públicas", () => {
  test("landing page carrega corretamente", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/LUCRIO/);
    await expect(page.locator("text=LUCRIO").first()).toBeVisible();
  });

  test("login page carrega corretamente", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("text=Entre na sua conta")).toBeVisible();
    await expect(page.locator("input[type='email']")).toBeVisible();
    await expect(page.locator("input[type='password']")).toBeVisible();
  });

  test("cadastro page carrega corretamente", async ({ page }) => {
    await page.goto("/cadastro");
    await expect(page.locator("text=Criar Conta")).toBeVisible();
    await expect(page.locator("input[type='email']")).toBeVisible();
  });

  test("recuperar-senha page carrega corretamente", async ({ page }) => {
    await page.goto("/recuperar-senha");
    await expect(page.locator("text=Recupere sua senha")).toBeVisible();
  });
});

test.describe("Proteção de Rotas", () => {
  const rotasProtegidas = [
    "/dashboard",
    "/dashboard/receitas",
    "/dashboard/despesas",
    "/dashboard/clientes",
    "/dashboard/servicos",
    "/dashboard/propostas",
    "/dashboard/fluxo-caixa",
    "/dashboard/relatorios",
    "/dashboard/configuracoes",
    "/dashboard/calendario",
    "/dashboard/indicar",
  ];

  for (const rota of rotasProtegidas) {
    test(`redireciona ${rota} para login`, async ({ page }) => {
      await page.goto(rota);
      await expect(page).toHaveURL(/\/login/);
    });
  }
});

test.describe("Admin Proteção", () => {
  const rotasAdmin = [
    "/admin",
    "/admin/usuarios",
    "/admin/planos",
    "/admin/assinaturas",
    "/admin/cupons",
    "/admin/financeiro",
    "/admin/indicacoes",
    "/admin/campanhas",
    "/admin/suporte",
    "/admin/avisos",
  ];

  for (const rota of rotasAdmin) {
    test(`redireciona ${rota} para login`, async ({ page }) => {
      await page.goto(rota);
      await expect(page).toHaveURL(/\/login/);
    });
  }
});

test.describe("Layout Responsivo", () => {
  test("login não tem scroll horizontal em mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/login");
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);
  });

  test("cadastro não tem scroll horizontal em mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/cadastro");
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);
  });

  test("landing não tem scroll horizontal em mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);
  });
});

test.describe("Formulário Login", () => {
  test("mostra erro com credenciais inválidas", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", "invalido@email.com");
    await page.fill("input[type='password']", "senhaerrada123");
    await page.click("button[type='submit']");
    await expect(page.locator("text=Email ou senha incorretos")).toBeVisible({ timeout: 10000 });
  });

  test("botão Google OAuth está visível", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("text=Entrar com Google")).toBeVisible();
  });
});

test.describe("Formulário Cadastro", () => {
  test("campos obrigatórios estão presentes", async ({ page }) => {
    await page.goto("/cadastro");
    await expect(page.locator("input#nome")).toBeVisible();
    await expect(page.locator("input[type='email']")).toBeVisible();
    await expect(page.locator("input[type='password']").first()).toBeVisible();
  });

  test("link para login está presente", async ({ page }) => {
    await page.goto("/cadastro");
    await expect(page.locator("text=Já tem uma conta")).toBeVisible();
  });
});
