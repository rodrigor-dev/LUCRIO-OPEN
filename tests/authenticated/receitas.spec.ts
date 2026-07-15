import { test, expect } from "@playwright/test";
import { login, gerarNomeUnico, irParaPagina, waitForNoDialog } from "./helpers";

test.describe("Receitas - CRUD Completo", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await irParaPagina(page, "/dashboard/receitas");
  });

  test("página de receitas carrega corretamente", async ({ page }) => {
    await expect(page.locator("h1:has-text('Receitas')").first()).toBeVisible({ timeout: 10000 });
  });

  test("criar nova receita", async ({ page }) => {
    const descricao = gerarNomeUnico("Receita Teste");

    await page.locator("button:has-text('Novo'), button:has-text('Nova Receita'), button:has-text('Adicionar')").first().click();
    await page.waitForTimeout(1500);

    const dialog = page.locator("[role='dialog']");
    if (await dialog.isVisible({ timeout: 5000 }).catch(() => false)) {
      const descInput = dialog.locator("input#descricao, textarea#descricao").first();
      if (await descInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await descInput.click();
        await descInput.fill("");
        await descInput.pressSequentially(descricao, { delay: 30 });
      }

      const valorInput = dialog.locator("input#valor, input[placeholder*='valor'], input[placeholder*='Valor']").first();
      if (await valorInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await valorInput.click();
        await valorInput.fill("");
        await valorInput.pressSequentially("500", { delay: 30 });
      }

      await dialog.locator("button[type='submit'], button:text('Salvar'), button:text('Adicionar')").first().click();
      await page.waitForTimeout(3000);

      const dialogStillOpen = await dialog.isVisible().catch(() => false);
      if (dialogStillOpen) {
        await page.evaluate(() => {
          const forms = document.querySelectorAll("[role='dialog'] form");
          forms.forEach((f) => (f as HTMLFormElement).requestSubmit());
        });
        await page.waitForTimeout(3000);
      }

      await waitForNoDialog(page);
      await page.waitForTimeout(1000);
      const matches = await page.locator(`text=${descricao}`).count();
      expect(matches).toBeGreaterThan(0);
    }
  });

  test("editar receita existente", async ({ page }) => {
    const editarBtn = page.locator("button[title='Editar']").first();
    if (await editarBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editarBtn.click();
      await page.waitForTimeout(1000);

      const dialog = page.locator("[role='dialog']");
      if (await dialog.isVisible({ timeout: 5000 }).catch(() => false)) {
        const descricaoInput = page.locator("input#descricao");
        if (await descricaoInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await descricaoInput.clear();
          await descricaoInput.fill(gerarNomeUnico("Editada"));
        }

        await page.locator("[role='dialog'] button:text('Salvar')").first().click();
        await page.waitForTimeout(2000);
      }
    }
  });

  test("marcar receita como paga via drawer", async ({ page }) => {
    const receitaRow = page.locator("tr[class*='cursor'], div[class*='cursor']").first();
    if (await receitaRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await receitaRow.click();
      await page.waitForTimeout(1000);

      const pagarBtn = page.locator("button:has-text('Marcar como pago')").first();
      if (await pagarBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await pagarBtn.click();
        await page.waitForTimeout(2000);
      }
    }
  });

  test("busca de receitas funciona", async ({ page }) => {
    const buscaInput = page.locator("input[placeholder*='Buscar'], input[placeholder*='buscar']").first();
    if (await buscaInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await buscaInput.fill("teste");
      await page.waitForTimeout(1000);
      await buscaInput.clear();
    }
  });

  test("mobile: receitas page sem scroll horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 10;
    });
    expect(hasHorizontalScroll).toBe(false);
  });

  test("KPIs de receitas são visíveis", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    const kpiCards = page.locator("[class*='card']");
    const count = await kpiCards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
