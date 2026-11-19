import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { nameFor } from '../game/appearance';
import type { DayController } from '../game/controller';
import { draw } from '../game/draw';
import { hitTest, toCanvasPoint, type Hit } from '../game/hit';
import { fitView, type View } from '../game/iso';
import { buildLayout } from '../game/layout';
import { createLoop } from '../game/loop';
import { buildScene, interpolate, targets, type Scene, type Spot } from '../game/scene';
import type { GameData } from '../sim/index';

interface Props {
  controller: DayController;
  data: GameData;
  lowGraphics: boolean;
}

const raf = (cb: (t: number) => void): number =>
  typeof requestAnimationFrame === 'function' ? requestAnimationFrame(cb) : (setTimeout(() => cb(performance.now()), 16) as unknown as number);
const caf = (id: number) => (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(id) : clearTimeout(id));

export function ClinicCanvas({ controller, data, lowGraphics }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layout = useMemo(() => buildLayout(data), [data]);
  const [selected, setSelected] = useState<Hit>(null);
  const lowRef = useRef(lowGraphics);
  const selectedRef = useRef<Hit>(null);
  const sceneRef = useRef<Scene | null>(null);
  const viewRef = useRef<View>(fitView(layout, 1280, 720));
  const sizeRef = useRef({ w: 1280, h: 720 });
  const renderRef = useRef<() => void>(() => {});

  lowRef.current = lowGraphics;
  selectedRef.current = selected;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
    let dpr = 1;
    let lastMinute = -1;
    let prev = new Map<string, Spot>();
    let next = new Map<string, Spot>();
    let inFrame = false;

    const render = () => {
      const sim = controller.sim;
      if (!sim) return;
      const snap = sim.snapshot();
      if (sim.now !== lastMinute) {
        prev = next;
        next = targets(layout, snap, sim);
        lastMinute = sim.now;
      }
      const alpha = controller.phase === 'running' ? controller.clock.fraction : 1;
      const scene = buildScene(layout, snap, sim, data, interpolate(prev, next, alpha, layout, lowRef.current));
      sceneRef.current = scene;
      const hit = selectedRef.current;
      if (ctx) draw(ctx, scene, viewRef.current, { lowGraphics: lowRef.current, dpr, highlight: hit?.kind === 'room' ? hit.station : null });
    };
    renderRef.current = render;

    const resize = () => {
      dpr = (typeof devicePixelRatio === 'number' && devicePixelRatio > 0) ? devicePixelRatio : 1;
      const w = canvas.clientWidth || 1280;
      const h = canvas.clientHeight || 720;
      sizeRef.current = { w, h };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      viewRef.current = fitView(layout, w, h);
      render();
    };

    const loop = createLoop({
      raf,
      caf,
      shouldRun: () => controller.phase === 'running' && controller.clock.speed > 0,
      onFrame: (dt) => {
        inFrame = true;
        controller.frame(dt);
        inFrame = false;
        render();
      },
    });
    const off = controller.subscribe(() => {
      loop.wake();
      if (!inFrame) render();
    });
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);
    resize();
    loop.wake();
    return () => {
      off();
      loop.stop();
      observer?.disconnect();
    };
  }, [controller, data, layout]);

  useEffect(() => renderRef.current(), [lowGraphics, selected]);

  const onPointerDown = (e: PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !sceneRef.current) return;
    const { w, h } = sizeRef.current;
    const p = toCanvasPoint(e.clientX, e.clientY, canvas.getBoundingClientRect(), w, h);
    setSelected(hitTest(sceneRef.current, viewRef.current, p.sx, p.sy));
  };

  return (
    <>
      <canvas ref={canvasRef} onPointerDown={onPointerDown} aria-label="Clinic floor" role="img" />
      {selected && <InfoCard controller={controller} data={data} hit={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function InfoCard({ controller, data, hit, onClose }: { controller: DayController; data: GameData; hit: NonNullable<Hit>; onClose(): void }) {
  const sim = controller.sim;
  if (!sim) return null;
  let body: preact.ComponentChildren = null;
  if (hit.kind === 'room') {
    const station = data.stations.find((s) => s.id === hit.station)!;
    const snap = sim.snapshot().stations.find((s) => s.id === hit.station)!;
    const names = snap.seats.map((seat) => data.staff.find((s) => s.id === seat.staffId)?.name ?? seat.staffId);
    body = (
      <>
        <strong>{station.label}</strong>
        <div>{snap.queue.length} waiting</div>
        <div>{names.length > 0 ? names.join(', ') : 'No staff'}</div>
      </>
    );
  } else if (hit.key.startsWith('p')) {
    const p = sim.patients.find((x) => x.id === Number(hit.key.slice(1)));
    if (!p) return null;
    const visit = data.visitTypes.find((v) => v.id === p.visitType);
    body = (
      <>
        <strong>{nameFor(hit.key, p.unit === 'mch' ? 'f' : 'any')}</strong>
        <div>{visit?.label ?? p.visitType}{p.colour ? ` · kod ${p.colour}` : ''}</div>
        <div>Waited {p.waitMinutes} min so far</div>
      </>
    );
  } else {
    const person = data.staff.find((s) => s.id === hit.key.slice(2));
    body = <strong>{person?.name ?? hit.key}</strong>;
  }
  return (
    <div class="info" role="dialog" aria-label="Details">
      {body}
      <div><button type="button" onClick={onClose}>Close</button></div>
    </div>
  );
}
