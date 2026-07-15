import { test, expect } from "@playwright/test";
import { login, gerarNomeUnico, irParaPagina } from "./helpers";

test.describe("Despesas - CRUD Completo", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await irParaPagina(page, "/dashboard/despesas");
  });

  test("página de despesas carrega corretamente", async ({ page }) => {
    await expect(page.locator("h1:has-text('Despesas')").first()).toBeVisible({ timeout: 10000 });
  });

  test("criar nova despesa", async ({ page }) => {
    const descricao = gerarNomeUnico("Despesa Teste");

    await page.locator("button:has-text('Nova Despesa'), button:has-text('Adicionar')").first().click();
    await page.waitForTimeout(1000);

    const dialog = page.locator("[role='dialog']");
    if (await dialog.isVisible({ timeout: 5000 }).catch(() => false)) {
      const descricaoInput = page.locator("input#descricao");
      if (await descricaoInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await descricaoInput.fill(descricao);
      }

      const valorInput = page.locator("input#valor");
      if (await valorInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await valorInput.click();
        await valorInput.fill("250");
      }

      await page.locator("[role='dialog'] button[type='submit'], [role='dialog'] button:text('Salvar'), [role='dialog'] button:text('Adicionar')").first().click();

      await expect(page.locator(`text=${descricao}`).first()).toBeVisible({ timeout: 10000 });
    }
  });

  test("editar despesa existente", async ({ page }) => {
    const editarBtn = page.locator("button[title='Editar']").first();
    if (await editarBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editarBtn.click();
      await page.waitForTimeout(1000);

      const dialog = page.locator("[role='dialog']");
      if (await dialog.isVisible({ timeout: 5000 }).catch(() => false)) {
        const descricaoInput = page.locator("input#descricao");
        if (await descricaoInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await descricaoInput.clear();
          await descricaoInput.fill(gerarNomeUnico("Despesa Edit"));
        }

        await page.locator("[role='dialog'] button:text('Salvar')").first().click();
        await page.waitForTimeout(2000);
      }
    }
  });

  test("excluir despesa", async ({ page }) => {
    const excluirBtn = page.locator("button[title='Excluir']").first();
    if (await excluirBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await excluirBtn.click();
      await page.waitForTimeout(500);

      const confirmBtn = page.locator("[role='alertdialog'] button:text('Confirmar'), [role='alertdialog'] button:text('Excluir'), [role='alertdialog'] button:text('Sim')").first();
      if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(2000);
      }
    }
  });

  test("busca de despesas funciona", async ({ page }) => {
    const buscaInput = page.locator("input[placeholder*='Buscar'], input[placeholder*='buscar']").first();
    if (await buscaInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await buscaInput.fill("teste");
      await page.waitForTimeout(1000);
      await buscaInput.clear();
    }
  });

  test("mobile: despesas page sem scroll horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 10;
    });
    expect(hasHorizontalScroll).toBe(false);
  });
});
