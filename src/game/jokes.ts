import { hash } from './appearance';

export type JokeSituation =
  | 'longWait'
  | 'resultOnly'
  | 'doctorIdle'
  | 'ccmsDown'
  | 'printerDown'
  | 'influx'
  | 'emergency'
  | 'lunchMissed';

/** Speech bubbles and toasts, in the Malay/Manglish you hear at the counter. */
export const LINES: Record<JokeSituation, string[]> = {
  longWait: ['Lama lagi ke?', 'Nombor saya bila nak naik?', 'Dah dua jam ni…', 'Parking dah habis masa ni.'],
  resultOnly: ['Saya nak ambil result darah je…', 'Doktor cuma nak tengok BP saya je kan?'],
  doctorIdle: ['☕ Mana pesakit?', '☕ Sunyi pula pagi ni…'],
  ccmsDown: ['CCMS down lagi. Tukar ke daftar manual?'],
  printerDown: ['Printer tak connect…', 'Siapa ada toner?'],
  influx: ['Bas sekolah asrama dah sampai!'],
  emergency: ['Kes kecemasan! Seorang doktor ke bilik rawatan.'],
  lunchMissed: ['Tak sempat makan…', 'Makan biskut kering je la hari ni.'],
};

export function pickLine(situation: JokeSituation, seed: number): string {
  const lines = LINES[situation];
  return lines[hash(`${situation}:${seed}`) % lines.length]!;
}
