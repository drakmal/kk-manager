import type { PlannedStep, SopSettings, VisitTypeId } from './types';

/**
 * Saringan di Kaunter: when registration finishes, decide the patient's
 * remaining route. Bypassable steps (e.g. the ANC nurse for a doctor-only
 * mother) are skipped only when the SOP card says so for this visit type AND
 * the counter can see today's appointments (CCMS up, or a printed list).
 * Steps are only removed, never reordered.
 */
export function filterRoute(
  remaining: PlannedStep[],
  visitType: VisitTypeId,
  sop: SopSettings,
  appointmentInfoAvailable: boolean,
): PlannedStep[] {
  const skip = sop.saringan.bypass[visitType] === true && appointmentInfoAvailable;
  return remaining.filter((step) => !(skip && step.bypassable)).map((step) => ({ ...step }));
}
