import { expect, test } from '@playwright/test';

test('a campaign day autosaves and continues after a reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'KK Manager' })).toBeVisible();
  await page.getByRole('button', { name: 'New campaign in slot 1' }).click();
  await expect(page.getByRole('heading', { name: /Malam · esok Isnin, Hari 1/ })).toBeVisible();
  await page.getByRole('button', { name: 'Baik' }).click();
  await page.getByRole('button', { name: 'Go to morning' }).click();
  await expect(page.getByRole('heading', { name: 'Pagi ini · Isnin · Hari 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Start the day' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Finish day' }).click();
  await page.getByRole('button', { name: 'Continue to tonight' }).click();
  await expect(page.getByRole('heading', { name: /Malam · esok Selasa, Hari 2/ })).toBeVisible();

  await page.reload();
  await expect(page.getByText('Slot 1 · Hari 2 (Selasa)')).toBeVisible();
  await page.getByRole('button', { name: 'Continue slot 1' }).click();
  await expect(page.getByRole('heading', { name: /Selasa/ })).toBeVisible();
  expect(errors).toEqual([]);
});
