import { test, expect } from '@playwright/test';

test.use({
  ignoreHTTPSErrors: true
});

test('test', async ({ page }) => {
  await page.goto('https://10.5.22.112/login');
  await page.getByRole('textbox', { name: 'Email or Username' }).click();
  await page.getByRole('textbox', { name: 'Email or Username' }).fill('playwright');
  await page.getByRole('textbox', { name: 'Password' }).click();
  await page.getByRole('textbox', { name: 'Password' }).click();
  await page.getByRole('textbox', { name: 'Password' }).fill('^yEsQ9%HW0Y1s1w56');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.getByTestId('navigation-insights').click();
  await page.getByTestId('THIRTY_MINUTES').click();
  await page.locator('.css-network-1c8lcdd > svg:nth-child(2)').click();
  await page.getByLabel('/ 3 / 2025 - 16 / 4 / 2025').click();
  await page.getByRole('button', { name: 'Last Hour' }).click();
  await page.getByRole('button', { name: 'Apply' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download' }).click();
  const download = await downloadPromise;
  await page.getByRole('button', { name: 'Blocked' }).click();
  await page.getByRole('option', { name: 'Threats' }).click();
  await page.locator('header').filter({ hasText: 'Download' }).getByTestId('close-button').click();
  await page.locator('.css-network-1c8lcdd > svg:nth-child(2) > path').first().click();
  const download1Promise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download' }).click();
  const download1 = await download1Promise;
});