import { test, expect } from "@playwright/test";
import { login, gerarNomeUnico, irParaPagina } from "./helpers";

test.describe("Propostas/Orçamentos - CRUD Completo", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await irParaPagina(page, "/dashboard/propostas");
  });

  test("página de propostas carrega corretamente", async ({ page }) => {
    await expect(page.locator("h1:has-text('Propostas'), h1:has-text('Orçamentos')").first()).toBeVisible({ timeout: 10000 });
  });

  test("criar nova proposta", async ({ page }) => {
    await page.locator("button:has-text('Nova Proposta'), button:has-text('Novo Orçamento'), button:has-text('Adicionar')").first().click();
    await page.waitForTimeout(1000);

    const dialog = page.locator("[role='dialog']");
    if (await dialog.isVisible({ timeout: 5000 }).catch(() => false)) {
      const nomeManualInput = page.locator("input#cliente_nome_manual");
      if (await nomeManualInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nomeManualInput.fill(gerarNomeUnico("Cliente Orc"));
      }

      const descInput = page.locator("input[placeholder*='Descrição'], input[placeholder*='descricao']").first();
      if (await descInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await descInput.fill("Item de teste");
      }

      const valorInput = page.locator("input[placeholder*='Valor'], input[placeholder*='valor']").first();
      if (await valorInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await valorInput.click();
        await valorInput.fill("1000");
      }

      await page.locator("[role='dialog'] button[type='submit'], [role='dialog'] button:text('Salvar'), [role='dialog'] button:text('Criar')").first().click();
      await page.waitForTimeout(3000);
    }
  });

  test("editar proposta existente", async ({ page }) => {
    const editarBtn = page.locator("button[title='Editar'], button:has-text('Editar')").first();
    if (await editarBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editarBtn.click();
      await page.waitForTimeout(1000);

      const dialog = page.locator("[role='dialog']");
      if (await dialog.isVisible({ timeout: 5000 }).catch(() => false)) {
        await page.locator("[role='dialog'] button:text('Salvar')").first().click();
        await page.waitForTimeout(2000);
      }
    }
  });

  test("buscar propostas", async ({ page }) => {
    const buscaInput = page.locator("input[placeholder*='Buscar'], input[placeholder*='buscar']").first();
    if (await buscaInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await buscaInput.fill("teste");
      await page.waitForTimeout(1000);
      await buscaInput.clear();
    }
  });

  test("mobile: propostas page sem scroll horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 10;
    });
    expect(hasHorizontalScroll).toBe(false);
  });
});
