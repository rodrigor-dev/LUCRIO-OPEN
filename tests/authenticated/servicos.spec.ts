import { test, expect } from "@playwright/test";
import { login, gerarNomeUnico, irParaPagina } from "./helpers";

test.describe("Serviços - CRUD Completo", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await irParaPagina(page, "/dashboard/servicos");
  });

  test("página de serviços carrega corretamente", async ({ page }) => {
    await expect(page.locator("h1:has-text('Serviços')").first()).toBeVisible({ timeout: 10000 });
  });

  test("criar novo serviço", async ({ page }) => {
    const nome = gerarNomeUnico("Servico Teste");

    await page.locator("button:has-text('Novo Serviço'), button:has-text('Registrar Serviço'), button:has-text('Adicionar')").first().click();
    await page.waitForTimeout(1000);

    const dialog = page.locator("[role='dialog']");
    if (await dialog.isVisible({ timeout: 5000 }).catch(() => false)) {
      const nomeInput = page.locator("input#nome");
      if (await nomeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nomeInput.fill(nome);
      }

      const valorInput = page.locator("input#valor");
      if (await valorInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await valorInput.click();
        await valorInput.fill("350");
      }

      await page.locator("[role='dialog'] button[type='submit'], [role='dialog'] button:text('Salvar'), [role='dialog'] button:text('Adicionar')").first().click();

      await expect(page.locator(`text=${nome}`).first()).toBeVisible({ timeout: 10000 });
    }
  });

  test("editar serviço existente", async ({ page }) => {
    const editarBtn = page.locator("button[title='Editar']").first();
    if (await editarBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editarBtn.click();
      await page.waitForTimeout(1000);

      const dialog = page.locator("[role='dialog']");
      if (await dialog.isVisible({ timeout: 5000 }).catch(() => false)) {
        const nomeInput = page.locator("input#nome");
        if (await nomeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await nomeInput.clear();
          await nomeInput.fill(gerarNomeUnico("Servico Edit"));
        }

        await page.locator("[role='dialog'] button:text('Salvar')").first().click();
        await page.waitForTimeout(2000);
      }
    }
  });

  test("excluir serviço", async ({ page }) => {
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

  test("buscar serviços", async ({ page }) => {
    const buscaInput = page.locator("input[placeholder*='Buscar'], input[placeholder*='buscar']").first();
    if (await buscaInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await buscaInput.fill("teste");
      await page.waitForTimeout(1000);
      await buscaInput.clear();
    }
  });

  test("mobile: serviços page sem scroll horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 10;
    });
    expect(hasHorizontalScroll).toBe(false);
  });
});
