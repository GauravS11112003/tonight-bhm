// Ordinary least squares via the normal equations: (XᵀX) β = Xᵀy.
// Written by hand (no ML library) so every line can be explained to a judge.

/** Solve A x = b with Gaussian elimination and partial pivoting. */
export function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    if (Math.abs(M[col][col]) < 1e-12) throw new Error("Singular matrix: a feature never varies.");
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/** Fit y ≈ β₀ + β₁x₁ + … ; X rows exclude the intercept column, we add it here. */
export function fitOLS(X: number[][], y: number[]) {
  const rows = X.map((x) => [1, ...x]);
  const k = rows[0].length;
  const XtX = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => rows.reduce((s, r) => s + r[i] * r[j], 0)));
  const Xty = Array.from({ length: k }, (_, i) => rows.reduce((s, r, n) => s + r[i] * y[n], 0));
  const beta = solve(XtX, Xty);
  const predict = (x: number[]) => beta[0] + x.reduce((s, v, i) => s + v * beta[i + 1], 0);
  const residuals = X.map((x, i) => y[i] - predict(x));
  // Residual standard deviation with n − k degrees of freedom.
  const residualSD = Math.sqrt(residuals.reduce((s, e) => s + e * e, 0) / (y.length - k));
  return { beta, predict, residualSD };
}
