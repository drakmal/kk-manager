import { expect, test } from '@playwright/test';

test('play a day end to end', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await page.getByRole('button', { name: 'Free play' }).click();
  await expect(page.getByRole('heading', { name: 'Pagi ini · Hari 1' })).toBeVisible();
  await page.getByLabel(/CCMS down pagi/).check();
  await page.getByRole('button', { name: 'Start the day' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: '4×' }).click();
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('button', { name: 'Apply changes' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume' }).click();
  await page.getByRole('button', { name: 'Finish day' }).click();
  await expect(page.getByText(/Makan on time|Late lunch|Tak sempat makan/)).toBeVisible();
  await expect(page.getByRole('table', { name: 'Waiting time by visit type' })).toBeVisible();
  expect(errors).toEqual([]);
});
