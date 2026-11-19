import type { Role } from '../sim/index';

export interface Look {
  body: string;
  /** Hijab colour, or hair colour when `hijab` is false. */
  head: string;
  hijab: boolean;
  uniform: 'none' | 'doctor' | 'nurse' | 'staff';
}

/** FNV-1a: a small, stable string hash so looks and names never change between frames or reloads. */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const pick = <T>(list: readonly T[], key: string, salt = ''): T => list[hash(key + salt) % list.length]!;

const BODY = ['#4f9d8f', '#d98c3a', '#7a6cc4', '#c96a6a', '#5b8bd0', '#a3a24a', '#c77fb0', '#6aa3a0', '#d0a15e'];
const HIJAB = ['#5a3d7a', '#c94f4f', '#2e5c8a', '#d9a23a', '#3e7d6b', '#b5507d', '#6b6b6b', '#e07b39', '#4a6fa5'];
const HAIR = ['#2b2118', '#3b2a1e', '#1d1d1d', '#4a3426'];
const STAFF_BODY: Partial<Record<Role, string>> = {
  jm: '#8fb8de', ppk: '#7f9b7a', clerk: '#3b6fb6', lab: '#6c8ca8', pharmacy: '#5aa39a',
};

export function lookFor(key: string, role: Role | 'patient'): Look {
  if (role === 'doctor') return { body: '#ffffff', head: pick(HAIR, key), hijab: hash(key) % 2 === 0, uniform: 'doctor' };
  if (role === 'nurse') return { body: '#ffffff', head: '#ffffff', hijab: true, uniform: 'nurse' };
  if (role !== 'patient') {
    const hijab = hash(key) % 3 !== 0;
    return { body: STAFF_BODY[role] ?? '#7a8794', head: hijab ? '#ffffff' : pick(HAIR, key), hijab, uniform: 'staff' };
  }
  const hijab = hash(key) % 10 < 7;
  return { body: pick(BODY, key, 'b'), head: hijab ? pick(HIJAB, key, 'h') : pick(HAIR, key, 'h'), hijab, uniform: 'none' };
}

/** Fictional names (spec 6.4). Patients in MCH are mothers, so callers pass 'f' for them. */
export const NAME_LISTS = {
  malay: ['Nurul Ain', 'Siti Aminah', 'Farah Hanim', 'Nor Azura', 'Aisyah Humaira', 'Fatimah Zahra', 'Zarina Ismail', 'Nur Hidayah', 'Rohani Yusof', 'Syafiqah Rahman'],
  chinese: ['Tan Mei Ling', 'Lim Siew Lan', 'Wong Li Ting', 'Chong Pei Shan', 'Lee Hui Min', 'Ng Su Yin'],
  indian: ['Kavitha a/p Raman', 'Priya a/p Subramaniam', 'Deepa a/p Murugan', 'Lakshmi a/p Krishnan', 'Shalini a/p Rajan'],
  malayMale: ['Ahmad Faizal', 'Muhammad Hafiz', 'Mohd Azlan', 'Khairul Anuar', 'Zulkifli Hassan'],
  chineseMale: ['Tan Wei Jie', 'Lim Chee Keong', 'Wong Kah Wai'],
  indianMale: ['Rajesh a/l Kumar', 'Suresh a/l Pillai', 'Ganesh a/l Muthu'],
} as const;

export function nameFor(key: string, gender: 'f' | 'any' = 'any'): string {
  const h = hash(key + 'name');
  // Roughly the Malaysian mix: about 6 in 10 Malay, 2.5 Chinese, 1.5 Indian.
  const group = h % 20 < 12 ? 'malay' : h % 20 < 17 ? 'chinese' : 'indian';
  const male = gender === 'any' && (h >>> 8) % 2 === 1;
  const list: readonly string[] = male ? NAME_LISTS[`${group}Male`] : NAME_LISTS[group];
  return list[(h >>> 12) % list.length]!;
}

/** Purpose dots above patients. Labels for the legend come from the game data. */
export const PURPOSE_COLOUR: Record<string, string> = {
  anc_booking: '#b0367a',
  anc_nurse_only: '#e2558f',
  anc_nurse_doctor: '#f08ab4',
  anc_doctor_only: '#2f9e52',
  postnatal: '#8455c9',
  child_health: '#2a83cf',
  immunisation: '#5fa8e6',
  opd_general: '#9a8f7a',
};

export const purposeColour = (visitType: string): string => PURPOSE_COLOUR[visitType] ?? '#8a8f96';
