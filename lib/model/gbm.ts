// Gradient-boosted regression trees, written by hand (no ML library) so the team can
// explain every line. Squared-error loss: each new small tree is fitted to what the
// trees before it got wrong, and its answer is added in with a small learning rate.
//
// Monotone constraints keep the model physically sensible: it may never say that a
// colder night, a longer cold spell or more rain means FEWER people. That is the same
// spirit as "rules override the model": staff should never have to argue with a
// forecast that contradicts the weather.

export type Monotone = -1 | 0 | 1; // -1: output may only fall as the feature rises
export type GBMOptions = { trees: number; depth: number; rate: number; minLeaf: number; bins: number };
export const DEFAULTS: GBMOptions = { trees: 160, depth: 3, rate: 0.08, minLeaf: 12, bins: 24 };

type Node = { leaf: true; value: number } | { leaf: false; f: number; t: number; left: Node; right: Node };

export type GBM = {
  predict: (x: number[]) => number;
  importance: number[]; // share of total error reduction credited to each feature, sums to 1
  trees: number;
};

/** Candidate split points per feature: up to `bins` distinct quantiles of the training data. */
function thresholds(X: number[][], f: number, bins: number) {
  const vals = [...new Set(X.map((x) => x[f]))].sort((a, b) => a - b);
  if (vals.length <= bins) return vals.slice(0, -1).map((v, i) => (v + vals[i + 1]) / 2);
  return Array.from({ length: bins - 1 }, (_, i) => vals[Math.floor(((i + 1) * vals.length) / bins)]);
}

export function fitGBM(X: number[][], y: number[], mono: Monotone[], opt: GBMOptions = DEFAULTS): GBM {
  const n = y.length;
  const k = X[0].length;
  const cuts = Array.from({ length: k }, (_, f) => thresholds(X, f, opt.bins));
  // Pre-bin every value once: bin b means "value is above cut b-1 and at or below cut b".
  const bin = X.map((x) => x.map((v, f) => { let b = 0; while (b < cuts[f].length && v > cuts[f][b]) b++; return b; }));
  const base = y.reduce((a, b) => a + b, 0) / n;
  const pred = new Array<number>(n).fill(base);
  const gain = new Array<number>(k).fill(0);
  const forest: Node[] = [];

  function grow(idx: number[], depth: number, resid: number[], lo: number, hi: number): Node {
    const sum = idx.reduce((s, i) => s + resid[i], 0);
    const clamp = (v: number) => Math.min(hi, Math.max(lo, v));
    const leaf = (): Node => ({ leaf: true, value: clamp(sum / idx.length) });
    if (depth === 0 || idx.length < 2 * opt.minLeaf) return leaf();

    let best = { g: 1e-9, f: -1, b: -1, lv: 0, rv: 0 };
    const parent = (sum * sum) / idx.length;
    for (let f = 0; f < k; f++) {
      const nb = cuts[f].length + 1;
      const s = new Array<number>(nb).fill(0), c = new Array<number>(nb).fill(0);
      for (const i of idx) { s[bin[i][f]] += resid[i]; c[bin[i][f]]++; }
      let sl = 0, cl = 0;
      for (let b = 0; b < nb - 1; b++) {
        sl += s[b]; cl += c[b];
        const cr = idx.length - cl;
        if (cl < opt.minLeaf || cr < opt.minLeaf) continue;
        const lv = sl / cl, rv = (sum - sl) / cr;
        if (mono[f] === 1 && lv > rv) continue; // rising feature must not lower the output
        if (mono[f] === -1 && lv < rv) continue;
        const g = (sl * sl) / cl + ((sum - sl) * (sum - sl)) / cr - parent;
        if (g > best.g) best = { g, f, b, lv, rv };
      }
    }
    if (best.f < 0) return leaf();
    gain[best.f] += best.g;
    const left = idx.filter((i) => bin[i][best.f] <= best.b);
    const right = idx.filter((i) => bin[i][best.f] > best.b);
    // Monotone bounds: children of a constrained split may not cross the midpoint.
    let [llo, lhi, rlo, rhi] = [lo, hi, lo, hi];
    const mid = (best.lv + best.rv) / 2;
    if (mono[best.f] === 1) { lhi = Math.min(hi, mid); rlo = Math.max(lo, mid); }
    if (mono[best.f] === -1) { llo = Math.max(lo, mid); rhi = Math.min(hi, mid); }
    return { leaf: false, f: best.f, t: cuts[best.f][best.b], left: grow(left, depth - 1, resid, llo, lhi), right: grow(right, depth - 1, resid, rlo, rhi) };
  }

  const walk = (node: Node, x: number[]): number => (node.leaf ? node.value : walk(x[node.f] <= node.t ? node.left : node.right, x));
  const all = Array.from({ length: n }, (_, i) => i);
  for (let t = 0; t < opt.trees; t++) {
    const resid = y.map((v, i) => v - pred[i]);
    const tree = grow(all, opt.depth, resid, -Infinity, Infinity);
    forest.push(tree);
    for (let i = 0; i < n; i++) pred[i] += opt.rate * walk(tree, X[i]);
  }
  const total = gain.reduce((a, b) => a + b, 0) || 1;
  return {
    predict: (x) => base + opt.rate * forest.reduce((s, tree) => s + walk(tree, x), 0),
    importance: gain.map((g) => g / total),
    trees: forest.length,
  };
}
