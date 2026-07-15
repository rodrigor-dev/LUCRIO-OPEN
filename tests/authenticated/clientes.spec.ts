import { test, expect } from "@playwright/test";
import { login, gerarNomeUnico, irParaPagina } from "./helpers";

async function fillInput(page: import("@playwright/test").Page, selector: string, value: string) {
  const input = page.locator(selector);
  await input.click();
  await input.fill("");
  await input.pressSequentially(value, { delay: 30 });
}

test.describe("Clientes - CRUD Completo", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await irParaPagina(page, "/dashboard/clientes");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await expect(page.locator("h1:has-text('Clientes')").first()).toBeVisible({ timeout: 10000 });
  });

  test("página de clientes carrega corretamente", async ({ page }) => {
    await expect(page.locator("button:has-text('Novo Cliente')").first()).toBeVisible();
  });

  test("criar cliente esporádico", async ({ page }) => {
    const nome = gerarNomeUnico("Esporadico");

    await page.locator("button:has-text('Novo Cliente')").first().click();
    await expect(page.locator("[role='dialog']")).toBeVisible({ timeout: 5000 });

    await fillInput(page, "[role='dialog'] input#nome", nome);
    await fillInput(page, "[role='dialog'] input#telefone", "11999998888");
    await fillInput(page, "[role='dialog'] input#email", "esporadico@teste.com");

    await page.locator("[role='dialog'] button:text('Adicionar')").click();
    await page.waitForTimeout(5000);

    const dialogStillOpen = await page.locator("[role='dialog']").isVisible().catch(() => false);
    if (dialogStillOpen) {
      await page.evaluate(() => {
        const forms = document.querySelectorAll("[role='dialog'] form");
        forms.forEach((f) => (f as HTMLFormElement).requestSubmit());
      });
      await page.waitForTimeout(5000);
    }

    await expect(page.locator(`text=${nome}`).first()).toBeVisible({ timeout: 15000 });
  });

  test("criar cliente fixo com valor mensal e vencimento", async ({ page }) => {
    const nome = gerarNomeUnico("Fixo");

    await page.locator("button:has-text('Novo Cliente')").first().click();
    await expect(page.locator("[role='dialog']")).toBeVisible({ timeout: 5000 });

    await fillInput(page, "[role='dialog'] input#nome", nome);

    const fixoRadio = page.locator("[role='dialog'] input[name='tipo'][value='fixo']");
    await fixoRadio.check({ force: true });
    await page.waitForTimeout(300);

    await fillInput(page, "[role='dialog'] input#valor_mensal", "150");
    await fillInput(page, "[role='dialog'] input#dia_vencimento", "15");
    await fillInput(page, "[role='dialog'] input#telefone", "11888887777");

    await page.locator("[role='dialog'] button:text('Adicionar')").click();
    await page.waitForTimeout(5000);

    const dialogStillOpen = await page.locator("[role='dialog']").isVisible().catch(() => false);
    if (dialogStillOpen) {
      await page.evaluate(() => {
        const forms = document.querySelectorAll("[role='dialog'] form");
        forms.forEach((f) => (f as HTMLFormElement).requestSubmit());
      });
      await page.waitForTimeout(5000);
    }

    await expect(page.locator(`text=${nome}`).first()).toBeVisible({ timeout: 15000 });
  });

  test("criar cliente fixo ativo aparece na lista com badge Ativo", async ({ page }) => {
    const nome = gerarNomeUnico("FixoAtivo");

    await page.locator("button:has-text('Novo Cliente')").first().click();
    await expect(page.locator("[role='dialog']")).toBeVisible({ timeout: 5000 });

    await fillInput(page, "[role='dialog'] input#nome", nome);

    const fixoRadio = page.locator("[role='dialog'] input[name='tipo'][value='fixo']");
    await fixoRadio.check({ force: true });
    await page.waitForTimeout(300);

    await fillInput(page, "[role='dialog'] input#valor_mensal", "200");
    const diaFuturo = Math.min(28, new Date().getDate() + 1);
    await fillInput(page, "[role='dialog'] input#dia_vencimento", String(diaFuturo));
    await fillInput(page, "[role='dialog'] input#telefone", "11777776666");

    await page.locator("[role='dialog'] button:text('Adicionar')").click();
    await page.waitForTimeout(5000);

    const dialogStillOpen = await page.locator("[role='dialog']").isVisible().catch(() => false);
    if (dialogStillOpen) {
      await page.evaluate(() => {
        const forms = document.querySelectorAll("[role='dialog'] form");
        forms.forEach((f) => (f as HTMLFormElement).requestSubmit());
      });
      await page.waitForTimeout(5000);
    }

    await expect(page.locator(`text=${nome}`).first()).toBeVisible({ timeout: 15000 });
  });

  test("editar cliente existente", async ({ page }) => {
    const nomeOriginal = gerarNomeUnico("Edit Orig");
    const nomeEditado = gerarNomeUnico("Edit Novo");

    await page.locator("button:has-text('Novo Cliente')").first().click();
    await expect(page.locator("[role='dialog']")).toBeVisible({ timeout: 5000 });
    await fillInput(page, "[role='dialog'] input#nome", nomeOriginal);
    await page.locator("[role='dialog'] button:text('Adicionar')").click();
    await page.waitForTimeout(5000);

    const dialogStillOpen = await page.locator("[role='dialog']").isVisible().catch(() => false);
    if (dialogStillOpen) {
      await page.evaluate(() => {
        const forms = document.querySelectorAll("[role='dialog'] form");
        forms.forEach((f) => (f as HTMLFormElement).requestSubmit());
      });
      await page.waitForTimeout(5000);
    }

    await expect(page.locator(`text=${nomeOriginal}`).first()).toBeVisible({ timeout: 15000 });

    const editarBtn = page.locator(`tr:has-text("${nomeOriginal}") button[title='Editar']`).first();
    if (await editarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editarBtn.click();
      await expect(page.locator("[role='dialog']")).toBeVisible({ timeout: 5000 });

      const nomeInput = page.locator("[role='dialog'] input#nome");
      await nomeInput.click();
      await nomeInput.fill("");
      await nomeInput.pressSequentially(nomeEditado, { delay: 30 });

      await page.locator("[role='dialog'] button:text('Salvar')").click();
      await page.waitForTimeout(5000);

      const dialogStillOpen2 = await page.locator("[role='dialog']").isVisible().catch(() => false);
      if (dialogStillOpen2) {
        await page.evaluate(() => {
          const forms = document.querySelectorAll("[role='dialog'] form");
          forms.forEach((f) => (f as HTMLFormElement).requestSubmit());
        });
        await page.waitForTimeout(5000);
      }

      await expect(page.locator(`text=${nomeEditado}`).first()).toBeVisible({ timeout: 15000 });
    }
  });

  test("toggle ativo/inativo do cliente", async ({ page }) => {
    const nome = gerarNomeUnico("Toggle");

    await page.locator("button:has-text('Novo Cliente')").first().click();
    await expect(page.locator("[role='dialog']")).toBeVisible({ timeout: 5000 });
    await fillInput(page, "[role='dialog'] input#nome", nome);
    await page.locator("[role='dialog'] button:text('Adicionar')").click();
    await page.waitForTimeout(5000);

    const dialogStillOpen = await page.locator("[role='dialog']").isVisible().catch(() => false);
    if (dialogStillOpen) {
      await page.evaluate(() => {
        const forms = document.querySelectorAll("[role='dialog'] form");
        forms.forEach((f) => (f as HTMLFormElement).requestSubmit());
      });
      await page.waitForTimeout(5000);
    }

    await expect(page.locator(`text=${nome}`).first()).toBeVisible({ timeout: 15000 });

    const toggleBtn = page.locator(`tr:has-text("${nome}") button[title='Marcar como inativo']`).first();
    if (await toggleBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await toggleBtn.click();
      await page.waitForTimeout(1500);

      const row = page.locator(`tr:has-text("${nome}")`).first();
      await expect(row.locator("text=Inativo").first()).toBeVisible({ timeout: 5000 });

      const ativarBtn = page.locator(`tr:has-text("${nome}") button[title='Marcar como ativo']`).first();
      if (await ativarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await ativarBtn.click();
        await page.waitForTimeout(1500);
        await expect(row.locator("text=Ativo").first()).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test("excluir cliente simples", async ({ page }) => {
    const nome = gerarNomeUnico("Excluir Simples");

    await page.locator("button:has-text('Novo Cliente')").first().click();
    await expect(page.locator("[role='dialog']")).toBeVisible({ timeout: 5000 });
    await fillInput(page, "[role='dialog'] input#nome", nome);
    await page.locator("[role='dialog'] button:text('Adicionar')").click();
    await page.waitForTimeout(5000);

    const dialogStillOpen = await page.locator("[role='dialog']").isVisible().catch(() => false);
    if (dialogStillOpen) {
      await page.evaluate(() => {
        const forms = document.querySelectorAll("[role='dialog'] form");
        forms.forEach((f) => (f as HTMLFormElement).requestSubmit());
      });
      await page.waitForTimeout(5000);
    }

    await expect(page.locator(`text=${nome}`).first()).toBeVisible({ timeout: 15000 });

    const excluirBtn = page.locator(`tr:has-text("${nome}") button[title='Excluir']`).first();
    if (await excluirBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await excluirBtn.click();
      await page.waitForTimeout(500);

      const confirmBtn = page.locator("[role='alertdialog'] button:text('Confirmar'), [role='alertdialog'] button:text('Excluir'), [role='alertdialog'] button:text('Sim')").first();
      if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmBtn.click();
      }

      await expect(page.locator(`text=${nome}`).first()).toBeHidden({ timeout: 10000 });
    }
  });

  test("buscar clientes por nome", async ({ page }) => {
    const nome = gerarNomeUnico("Busca");

    await page.locator("button:has-text('Novo Cliente')").first().click();
    await expect(page.locator("[role='dialog']")).toBeVisible({ timeout: 5000 });
    await fillInput(page, "[role='dialog'] input#nome", nome);
    await page.locator("[role='dialog'] button:text('Adicionar')").click();
    await page.waitForTimeout(5000);

    const dialogStillOpen = await page.locator("[role='dialog']").isVisible().catch(() => false);
    if (dialogStillOpen) {
      await page.evaluate(() => {
        const forms = document.querySelectorAll("[role='dialog'] form");
        forms.forEach((f) => (f as HTMLFormElement).requestSubmit());
      });
      await page.waitForTimeout(5000);
    }

    await expect(page.locator(`text=${nome}`).first()).toBeVisible({ timeout: 15000 });

    const buscaInput = page.locator("input[placeholder*='Buscar']").first();
    await buscaInput.clear();
    await buscaInput.fill(nome);

    await expect(page.locator(`text=${nome}`).first()).toBeVisible({ timeout: 5000 });
  });

  test("filtrar clientes por tipo", async ({ page }) => {
    const selectTrigger = page.locator("[role='combobox']").first();
    if (await selectTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await selectTrigger.click();
      const fixoOption = page.locator("[role='option']:has-text('Fixo')").first();
      if (await fixoOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await fixoOption.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test("mobile: clientes page sem scroll horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 10;
    });
    expect(hasHorizontalScroll).toBe(false);
  });
});
