// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/preact';
import { App } from '../../src/ui/App';
import { memoryStorage } from '../../src/week/storage';

afterEach(cleanup);

test('the app opens on the difficulty page with three boxes', () => {
  render(<App storage={memoryStorage()} />);
  expect(screen.getByRole('heading', { name: 'KK Manager' })).toBeTruthy();
  for (const name of ['Easy', 'Medium', 'Hard']) expect(screen.getByRole('region', { name })).toBeTruthy();
});

test('it opens with the default browser storage too', () => {
  render(<App />);
  expect(screen.getByRole('region', { name: 'Easy' })).toBeTruthy();
});
