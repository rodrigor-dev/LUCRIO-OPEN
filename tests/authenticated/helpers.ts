import { Page, expect } from "@playwright/test";

const TEST_EMAIL = process.env.TEST_EMAIL || "teste@lucrio.com";
const TEST_PASSWORD = process.env.TEST_PASSWORD || "Teste123!@#";
const SUPABASE_URL = "https://szwrdhmwrmxayfyyozhp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6d3JkaG13cm14YXlmeXlvemhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MTIxMzQsImV4cCI6MjA5ODQ4ODEzNH0.kvySB_ki8JRRTNV029XT8TQVwRMOUumxkTNfgeyxXCs";
const COOKIE_KEY = "sb-szwrdhmwrmxayfyyozhp-auth-token";

function stringToBase64URL(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function login(page: Page) {
  const baseURL = process.env.BASE_URL || "https://lucrio-open.vercel.app";

  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });

  if (!res.ok) {
    throw new Error(`Supabase login failed: ${res.status} ${await res.text()}`);
  }

  const tokenData = await res.json();

  const sessionPayload = {
    access_token: tokenData.access_token,
    expires_at: tokenData.expires_at,
    expires_in: tokenData.expires_in,
    refresh_token: tokenData.refresh_token,
    token_type: tokenData.token_type,
    user: tokenData.user,
  };

  const sessionJSON = JSON.stringify(sessionPayload);
  const encoded = "base64-" + stringToBase64URL(sessionJSON);

  await page.goto(`${baseURL}/dashboard`);
  await page.waitForLoadState("domcontentloaded");

  await page.evaluate(({ key, value }) => {
    document.cookie = `${key}=${value}; path=/; max-age=34560000; samesite=lax`;
  }, { key: COOKIE_KEY, value: encoded });

  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
}

export async function irParaPagina(page: Page, path: string) {
  const baseURL = process.env.BASE_URL || "https://lucrio-open.vercel.app";
  await page.goto(`${baseURL}${path}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
}

export async function waitForNoDialog(page: Page) {
  await page.waitForFunction(() => !document.querySelector("[role='dialog']"), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
}

export function gerarNomeUnico(prefixo: string) {
  return `${prefixo} ${Date.now()}`;
}

export { TEST_EMAIL, TEST_PASSWORD };
