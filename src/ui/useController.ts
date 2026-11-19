import { useEffect, useState } from 'preact/hooks';
import type { DayController } from '../game/controller';

/** Re-renders the component whenever the controller changes. */
export function useController(controller: DayController): DayController {
  const [, setVersion] = useState(0);
  useEffect(() => controller.subscribe(() => setVersion((n) => n + 1)), [controller]);
  return controller;
}
