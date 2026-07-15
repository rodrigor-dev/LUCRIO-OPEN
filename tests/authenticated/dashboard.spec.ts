import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Dashboard - Navegação", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("dashboard carrega com KPIs visíveis", async ({ page }) => {
    await expect(page.locator("h1:has-text('Dashboard')").first()).toBeVisible();
    const cards = page.locator("[class*='card']");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
  });

  test("navega para clientes via sidebar", async ({ page }) => {
    const link = page.locator("a[href='/dashboard/clientes']").first();
    if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
      await link.click();
      await page.waitForURL(/\/dashboard\/clientes/);
      await expect(page.locator("h1:has-text('Clientes')").first()).toBeVisible();
    }
  });

  test("navega para receitas via sidebar", async ({ page }) => {
    const link = page.locator("a[href='/dashboard/receitas']").first();
    if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
      await link.click();
      await page.waitForURL(/\/dashboard\/receitas/);
      await expect(page.locator("h1:has-text('Receitas')").first()).toBeVisible();
    }
  });

  test("navega para despesas via sidebar", async ({ page }) => {
    const link = page.locator("a[href='/dashboard/despesas']").first();
    if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
      await link.click();
      await page.waitForURL(/\/dashboard\/despesas/);
      await expect(page.locator("h1:has-text('Despesas')").first()).toBeVisible();
    }
  });

  test("navega para serviços via sidebar", async ({ page }) => {
    const link = page.locator("a[href='/dashboard/servicos']").first();
    if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
      await link.click();
      await page.waitForURL(/\/dashboard\/servicos/);
      await expect(page.locator("h1:has-text('Serviços')").first()).toBeVisible();
    }
  });

  test("navega para propostas via sidebar", async ({ page }) => {
    const link = page.locator("a[href='/dashboard/propostas']").first();
    if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
      await link.click();
      await page.waitForURL(/\/dashboard\/propostas/);
      await expect(page.locator("h1:has-text('Propostas'), h1:has-text('Orçamentos')").first()).toBeVisible();
    }
  });

  test("navega para fluxo de caixa via sidebar", async ({ page }) => {
    const link = page.locator("a[href='/dashboard/fluxo-caixa']").first();
    if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
      await link.click();
      await page.waitForURL(/\/dashboard\/fluxo-caixa/);
      await expect(page.locator("h1:has-text('Fluxo de Caixa')").first()).toBeVisible();
    }
  });

  test("navega para relatórios via sidebar", async ({ page }) => {
    const link = page.locator("a[href='/dashboard/relatorios']").first();
    if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
      await link.click();
      await page.waitForURL(/\/dashboard\/relatorios/);
      await expect(page.locator("h1:has-text('Relatórios')").first()).toBeVisible();
    }
  });

  test("navega para configurações via sidebar", async ({ page }) => {
    const link = page.locator("a[href='/dashboard/configuracoes']").first();
    if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
      await link.click();
      await page.waitForURL(/\/dashboard\/configuracoes/);
      await expect(page.locator("h1:has-text('Configurações')").first()).toBeVisible();
    }
  });

  test("navega para calendário via sidebar", async ({ page }) => {
    const link = page.locator("a[href='/dashboard/calendario']").first();
    if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
      await link.click();
      await page.waitForURL(/\/dashboard\/calendario/);
      await expect(page.locator("h1, h2").filter({ hasText: /Calend/i }).first()).toBeVisible({ timeout: 10000 });
    }
  });

  test("navega para indicar via sidebar", async ({ page }) => {
    const link = page.locator("a[href='/dashboard/indicar']").first();
    if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
      await link.click();
      await page.waitForURL(/\/dashboard\/indicar/);
      await expect(page.locator("h1:has-text('Indique'), h1:has-text('Indicar')").first()).toBeVisible();
    }
  });
});
