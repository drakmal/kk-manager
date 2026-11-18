// @vitest-environment happy-dom
import { render, screen } from '@testing-library/preact';
import { App } from '../../src/ui/App';

test('renders the title', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'KK Manager' })).toBeTruthy();
});
