/**
 * Run simulated KK days headless and print the report.
 *
 *   npm run sim -- --seed 3
 *   npm run sim -- --days 20 --bypass anc_doctor_only
 *   npm run sim -- --days 20 --bypass anc_doctor_only --ccms 08:00-10:00 --printed-list
 */
import { defaultDayPlan, fmt, loadGameData, runDay, toMinute, type DayPlan, type DayReport } from '../src/sim/index';

interface Args {
  seed: number;
  days: number | null;
  bypass: string[];
  ccms: [number, number] | null;
  printedList: boolean;
  laluanKhas: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { seed: 1, days: null, bypass: [], ccms: null, printedList: false, laluanKhas: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${flag} needs a value`);
      return v;
    };
    switch (flag) {
      case '--seed': args.seed = Number(value()); break;
      case '--days': args.days = Number(value()); break;
      case '--bypass': args.bypass = value().split(',').filter(Boolean); break;
      case '--ccms': {
        const [from, to] = value().split('-');
        args.ccms = [toMinute(from!), toMinute(to!)];
        break;
      }
      case '--printed-list': args.printedList = true; break;
      case '--laluan-khas': args.laluanKhas = true; break;
      default: throw new Error(`Unknown option ${flag}`);
    }
  }
  return args;
}

const data = loadGameData();

function planFor(seed: number, a: Args): DayPlan {
  const plan = defaultDayPlan(data, seed);
  for (const id of a.bypass) {
    if (!(id in plan.sop.saringan.bypass)) throw new Error(`Unknown visit type "${id}" for --bypass`);
    plan.sop.saringan.bypass[id] = true;
  }
  plan.sop.kontingensiCcms.printedList = a.printedList;
  if (a.ccms) plan.events.push({ kind: 'ccmsDown', from: a.ccms[0], to: a.ccms[1] });
  if (a.laluanKhas) {
    plan.sop.laluanKhas = {
      enabled: true,
      groups: ['pregnant', 'elderly', 'oku', 'childUnder2'],
      stations: data.stations.map((s) => s.id),
    };
  }
  return plan;
}

const MCH_DOCTORS = data.staff.filter((s) => s.homeStation === 'mchDoctor').map((s) => s.id);
const pad = (v: string | number, n: number) => String(v).padEnd(n);
const num = (v: number) => (Math.round(v * 10) / 10).toFixed(1);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const label = (id: string) => data.visitTypes.find((v) => v.id === id)?.label ?? id;

function printWaitTable(rows: { id: string; count: number; mean: number; max: number }[]) {
  console.log('\nWait by visit type (minutes in queues)');
  console.log(`  ${pad('visit type', 20)}${pad('', 34)}${pad('count', 8)}${pad('mean', 8)}max`);
  for (const r of rows) console.log(`  ${pad(r.id, 20)}${pad(label(r.id), 34)}${pad(num(r.count), 8)}${pad(num(r.mean), 8)}${num(r.max)}`);
}

function printDay(r: DayReport) {
  console.log(`KK Manager: simulated day (seed ${r.seed})`);
  const lunches = r.lunch.perDoctor.map((d) => `${d.staffId} ${d.lunchStart === null ? 'tak sempat' : fmt(d.lunchStart)}`).join(', ');
  console.log(`Lunch: ${r.lunch.outcome}  (${lunches})`);
  console.log(`Balik: ${r.balik.outcome}  last patient ${r.balik.lastPatientDone === null ? '-' : fmt(r.balik.lastPatientDone)}, overtime ${r.balik.overtimeMinutes} staff-min`);
  console.log(`Patient satisfaction: ${num(r.patientSatisfaction)}   HCW satisfaction: ${num(r.hcwSatisfaction)}`);
  printWaitTable(Object.entries(r.waitByVisitType).map(([id, w]) => ({ id, ...w })));
  console.log(`\nMCH doctor idle 08:00–10:00: ${MCH_DOCTORS.map((id) => `${id} ${r.idleByStaff[id]?.morning ?? '-'} min`).join(', ')}`);
  const peaks = Object.entries(r.peakQueue).filter(([, p]) => p.size > 0).sort((a, b) => b[1].size - a[1].size);
  console.log(`Peak queues: ${peaks.map(([id, p]) => `${id} ${p.size} @ ${fmt(p.at)}`).join(', ')}`);
  console.log(`Turned away: ${r.turnedAway}, unfinished: ${r.unfinished}`);
}

function printAverages(reports: DayReport[]) {
  console.log(`KK Manager: averages over ${reports.length} simulated days (seeds 1..${reports.length})`);
  const count = (key: 'lunch' | 'balik') => {
    const tally: Record<string, number> = {};
    for (const r of reports) tally[r[key].outcome] = (tally[r[key].outcome] ?? 0) + 1;
    return Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(', ');
  };
  console.log(`Lunch: ${count('lunch')}`);
  console.log(`Balik: ${count('balik')}   mean overtime ${num(avg(reports.map((r) => r.balik.overtimeMinutes)))} staff-min`);
  console.log(`Patient satisfaction: ${num(avg(reports.map((r) => r.patientSatisfaction)))}   HCW satisfaction: ${num(avg(reports.map((r) => r.hcwSatisfaction)))}`);
  const ids = [...new Set(reports.flatMap((r) => Object.keys(r.waitByVisitType)))];
  printWaitTable(ids.map((id) => {
    const ws = reports.map((r) => r.waitByVisitType[id]).filter((w) => w !== undefined);
    return { id, count: avg(ws.map((w) => w.count)), mean: avg(ws.map((w) => w.mean)), max: avg(ws.map((w) => w.max)) };
  }));
  console.log(`\nMCH doctor idle 08:00–10:00 (mean): ${MCH_DOCTORS.map((id) => `${id} ${num(avg(reports.map((r) => r.idleByStaff[id]?.morning ?? 0)))} min`).join(', ')}`);
  console.log(`Turned away (mean): ${num(avg(reports.map((r) => r.turnedAway)))}, unfinished (mean): ${num(avg(reports.map((r) => r.unfinished)))}`);
}

try {
  const a = parseArgs(process.argv.slice(2));
  if (a.days === null) printDay(runDay(data, planFor(a.seed, a)));
  else printAverages(Array.from({ length: a.days }, (_, i) => runDay(data, planFor(i + 1, a))));
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
