import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT = path.resolve(
  __dirname,
  '../../server/training/receipt-samples/dashen-success-paid.png',
);

function requireE2eEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Set it in server/.env or your shell before running e2e tests.`);
  }
  return value;
}

const EMAIL = requireE2eEnv('E2E_EMAIL');
const PASSWORD = requireE2eEnv('E2E_PASSWORD');

test('Dashen success screenshot verifies via Quick Verify', async ({ page }) => {
  test.setTimeout(180000);

  await page.goto('http://localhost:5173/login');
  await page.getByPlaceholder('your@email.com').fill(EMAIL);
  await page.getByPlaceholder('••••••••').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|admin)/, { timeout: 15000 });

  if (page.url().includes('/admin')) {
    await page.goto('http://localhost:5173/dashboard');
  }

  await page.getByRole('button', { name: /verify receipt/i }).first().click();
  await page.getByRole('button', { name: /dashen bank/i }).click();

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(SCREENSHOT);
  await expect(page.getByText(/screenshot uploaded/i)).toBeVisible();

  await page.getByRole('button', { name: /^verify$/i }).click();

  const success = page.getByText(/valid receipt confirmed|receipt verified successfully/i);
  const duplicate = page.getByText(/already verified/i);
  const qrMissing = page.getByText(/qr code missing/i);

  await expect(qrMissing).not.toBeVisible({ timeout: 180000 });
  await expect(success.or(duplicate)).toBeVisible({ timeout: 180000 });
});
