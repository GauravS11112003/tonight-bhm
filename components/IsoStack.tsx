import type { AskKind, AskStatus } from "@/lib/asks";

// The quantity of an ask, drawn as an isometric stack. One block is a fixed number of
// units, so the size of the pile is the size of the request. Outlined while open,
// tinted when pledged, solid when fulfilled.
const SHAPE: Record<AskKind, { unit: number; fx: number; fy: number; tw: number; bh: number; gap: number; head?: boolean }> = {
  blankets: { unit: 10, fx: 3, fy: 2, tw: 50, bh: 9, gap: 1 }, // folded, so thin slabs
  water: { unit: 12, fx: 4, fy: 3, tw: 30, bh: 22, gap: 1.08 }, // cases
  meals: { unit: 20, fx: 3, fy: 3, tw: 42, bh: 15, gap: 1 }, // trays
  volunteers: { unit: 1, fx: 6, fy: 1, tw: 24, bh: 38, gap: 1.75, head: true }, // people
};

export function stackUnit(kind: AskKind, qty: number) {
  let unit = SHAPE[kind].unit;
  while (Math.ceil(qty / unit) > 30) unit *= 2;
  return unit;
}

export default function IsoStack({ kind, qty, status }: { kind: AskKind; qty: number; status: AskStatus }) {
  const s = SHAPE[kind];
  const unit = stackUnit(kind, qty);
  const n = Math.ceil(qty / unit);
  const fx = s.head ? Math.min(n, s.fx) : s.fx;
  const per = fx * s.fy;
  const th = s.tw / 2;
  const blocks = Array.from({ length: n }, (_, b) => {
    const k = Math.floor(b / per), r = b % per;
    return { i: r % fx, j: Math.floor(r / fx), k };
  }).sort((a, b) => a.k - b.k || a.i + a.j - (b.i + b.j));
  const layers = Math.ceil(n / per);
  // Centre the footprint horizontally and stand the pile on a fixed floor line.
  const W = 260, H = 150;
  const span = ((fx - 1) + (s.fy - 1)) * s.gap;
  const ox = W / 2 - (((fx - 1) - (s.fy - 1)) * s.gap * s.tw) / 4;
  const floor = H - 12;
  const oy = floor - (span * th) / 2 - th / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="iso h-[150px] w-full" data-status={status} role="img" aria-label={`${qty} ${kind}, ${status}. One block is ${unit}.`}>
      <ellipse cx={W / 2} cy={floor - (span * th) / 4 + 2} rx={Math.max(44, (fx + s.fy) * s.gap * s.tw * 0.34)} ry={Math.max(12, (fx + s.fy) * s.gap * th * 0.34)} className="iso-floor" />
      <g key={status}>
        {blocks.map((b, idx) => {
          const cx = ox + ((b.i - b.j) * s.gap * s.tw) / 2;
          const ty = oy + ((b.i + b.j) * s.gap * th) / 2 - (b.k + 1) * s.bh;
          const hw = s.tw / 2, hh = th / 2;
          return (
            <g key={idx} className="iso-block" style={{ ["--i" as string]: idx, ["--n" as string]: layers }}>
              <polygon className="iso-l" points={`${cx - hw},${ty} ${cx},${ty + hh} ${cx},${ty + hh + s.bh} ${cx - hw},${ty + s.bh}`} />
              <polygon className="iso-r" points={`${cx + hw},${ty} ${cx},${ty + hh} ${cx},${ty + hh + s.bh} ${cx + hw},${ty + s.bh}`} />
              <polygon className="iso-t" points={`${cx},${ty - hh} ${cx + hw},${ty} ${cx},${ty + hh} ${cx - hw},${ty}`} />
              {s.head && <circle className="iso-r" cx={cx} cy={ty - 13} r={9.5} />}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
