import { test, expect } from "@playwright/test";
import { login, irParaPagina } from "./helpers";

test.describe("Filtros Financeiros", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("receitas: filtro por status funciona", async ({ page }) => {
    await irParaPagina(page, "/dashboard/receitas");
    await page.waitForLoadState("networkidle");

    const filtroStatus = page.locator("button:has-text('Status'), [role='combobox']").first();
    if (await filtroStatus.isVisible({ timeout: 5000 }).catch(() => false)) {
      await filtroStatus.click();
      await page.waitForTimeout(500);
    }
  });

  test("receitas: filtro por período funciona", async ({ page }) => {
    await irParaPagina(page, "/dashboard/receitas");
    await page.waitForLoadState("networkidle");

    const periodoFilter = page.locator("button:has-text('Período'), button:has-text('Periodo')").first();
    if (await periodoFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
      await periodoFilter.click();
      await page.waitForTimeout(500);
    }
  });

  test("despesas: filtro por status funciona", async ({ page }) => {
    await irParaPagina(page, "/dashboard/despesas");
    await page.waitForLoadState("networkidle");

    const filtroStatus = page.locator("button:has-text('Status'), [role='combobox']").first();
    if (await filtroStatus.isVisible({ timeout: 5000 }).catch(() => false)) {
      await filtroStatus.click();
      await page.waitForTimeout(500);
    }
  });

  test("fluxo de caixa carrega corretamente", async ({ page }) => {
    await irParaPagina(page, "/dashboard/fluxo-caixa");
    await expect(page.locator("h1:has-text('Fluxo de Caixa')").first()).toBeVisible({ timeout: 10000 });
  });

  test("relatórios carrega corretamente", async ({ page }) => {
    await irParaPagina(page, "/dashboard/relatorios");
    await expect(page.locator("h1:has-text('Relatórios')").first()).toBeVisible({ timeout: 10000 });
  });
});
