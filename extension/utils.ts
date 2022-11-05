import { Buffer } from 'buffer';

export function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function round(x: number): number { return x + 0.5 << 0; }

export function ensureBuffer(chunk: Buffer | string): Buffer {
  return Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
}

const T = (A: number[][]): number[][] => A[0]?.map((_, i) => A.map((a) => a[i])) || [];
const dotVV = (a: number[], b: number[]): number => a.map((x, i) => a[i] * b[i]).reduce((m, n) => m + n);
const dotMV = (A: number[][], b: number[]): number[] => A.map((a) => dotVV(a, b));
const dotMM = (A: number[][], B:number[][]): number[][] => A.map((a) => dotMV(T(B), a));

const reduceV = <T>(v: T[], op: (v: T, x: T) => T): T => v.reduce((m, n) => op(m, n));
const reduceM = <T>(A: T[][], op: (v: T, x: T) => T): T => 
  A
    .reduce((a: T[], x: T[]): T[] => a.map((v, i) => op(v, x[i])))
    .reduce((m, n) => op(m, n));

const reduceM0 = <T>(A: T[][], op: (v: T, x: T) => T): T[] => A.reduce((a, x) => a.map((v, i) => op(v, x[i])));

const maskM0 = <T>(A: T[][], mask: boolean[]): T[][] => A.filter((a, i) => mask[i]);
const maskM1 = <T>(A: T[][], mask: boolean[]): T[][] => A.map((a) => a.filter((v, j) => mask[j]));

const sliceM0 = <T>(A: T[][], i: number): T[] => A[i];
const sliceM1 = <T>(A: T[][], i: number): T[] => A.map((a) => a[i]);

const opM = (A: number[][], op: (x: number, i?: number, j?: number) => number): number[][] => A.map((a, i) => a.map((v, j) => op(v, i, j)));
const opV = <T>(a: number[], op: (v: number, i?: number) => T): T[] => a.map((v, i) => op(v, i));
const opMV = (A: number[][], v: number[], op: (x: number, y: number, i?: number, j?: number) => number) => A.map((a) => a.map((x, j) => op(x, v[j])));

export function affineOrientation(A: number[][], tol?: number): number[] {
  const n = A.length;
  const m = A[0].length;
  const q = n - 1;
  const p = m - 1;

  const RZS = A.slice(0, q).map((a) => a.slice(0, p));
  const zooms = opV(reduceM0(opM(RZS, (x) => x * x), (v, x) => v + x), (v) => Math.sqrt(v));
  zooms.forEach((z, i) => zooms[i] = z == 0 ? 1 : z);

  const RS = opMV(RZS, zooms, (x, y) => x / y);
  const [P, S, Qs] = svd(RS);

  if (tol === undefined) {
    tol = reduceV(S, Math.max) * Math.max(RS.length, RS[0].length) * Number.EPSILON;
  }

  const keep = S.map((s) => s > tol!);
  const R = dotMM(maskM1(P, keep), maskM0(Qs, keep));
  const ornt = new Array(p).fill(0);

  for (let in_ax = 0; in_ax < p; in_ax++) {
    const col = sliceM1(R, in_ax);
    const colAbs = opV(col, Math.abs);
    const sum = reduceV(colAbs, (x, y) => x + y);
    if (sum > 1e-05) {
      const colI = opV(colAbs, (v, i) => [v, i]) as [number, number][];
      const out_ax = reduceV(colI, (x, y) => x[0] > y[0] ? x : y)[1];
      ornt[out_ax] = col[out_ax] < 0 ? -1 : 1;
      R[out_ax].fill(0);
    }
  }

  return ornt;
}

function svd(A: number[][], withu = true, withv = true, eps: number = Math.pow(2, -52), tol: number = 1e-64 / Math.pow(2, -52)): [number[][], number[], number[][]] {
  const n = A[0].length;
  const m = A.length;

  if (m < n) {
    throw new TypeError('Invalid matrix: m < n');
  }

  let i, j, k, l, l1, c, f, g, h, s, x, y, z;
  i = j = k = l = g = x = 0;

  const e = [];
  const u = [];
  const v = [];

  const mOrN = !withu ? m : n;

  for (i = 0; i < m; i++) {
    u[i] = new Array(mOrN).fill(0);
  }
  for (i = 0; i < n; i++) {
    v[i] = new Array(n).fill(0);
  }

  const q = new Array(n).fill(0);
  for (i = 0; i < m; i++) {
    for (j = 0; j < n; j++) {
      u[i][j] = A[i][j];
    }
  }

  for (i = 0; i < n; i++) {
    e[i] = g;
    s = 0;
    l = i + 1;
    for (j = i; j < m; j++) {
      s += u[j][i] ** 2;
    }
    if (s < tol) {
      g = 0;
    } else {
      f = u[i][i];
      g = f < 0 ? Math.sqrt(s) : -Math.sqrt(s);
      h = f * g - s;
      u[i][i] = f - g;
      for (j = l; j < n; j++) {
        s = 0;
        for (k = i; k < m; k++) {
          s += u[k][i] * u[k][j];
        }
        f = s / h;
        for (k = i; k < m; k++) {
          u[k][j] = u[k][j] + f * u[k][i];
        }
      }
    }
    q[i] = g;
    s = 0;
    for (j = l; j < n; j++) {
      s += u[i][j] ** 2;
    }
    if (s < tol) {
      g = 0;
    } else {
      f = u[i][i + 1];
      g = f < 0 ? Math.sqrt(s) : -Math.sqrt(s);
      h = f * g - s;
      u[i][i + 1] = f - g;
      for (j = l; j < n; j++) {
        e[j] = u[i][j] / h;
      }
      for (j = l; j < m; j++) {
        s = 0;
        for (k = l; k < n; k++) {
          s += u[j][k] * u[i][k];
        }
        for (k = l; k < n; k++) {
          u[j][k] = u[j][k] + s * e[k];
        }
      }
    }
    y = Math.abs(q[i]) + Math.abs(e[i]);
    x = Math.max(x, y);
  }

  if (withv) {
    for (i = n - 1; i >= 0; i--) {
      if (g !== 0) {
        h = u[i][i + 1] * g;
        for (j = l; j < n; j++) {
          v[j][i] = u[i][j] / h;
        }
        for (j = l; j < n; j++) {
          s = 0;
          for (k = l; k < n; k++) {
            s += u[i][k] * v[k][j];
          }
          for (k = l; k < n; k++) {
            v[k][j] = v[k][j] + s * v[k][i];
          }
        }
      }
      for (j = l; j < n; j++) {
        v[i][j] = 0;
        v[j][i] = 0;
      }
      v[i][i] = 1;
      g = e[i];
      l = i;
    }
  }

  if (withu) {
    for (i = n - 1; i >= 0; i--) {
      l = i + 1;
      g = q[i];
      for (j = l; j < mOrN; j++) {
        u[i][j] = 0;
      }
      if (g !== 0) {
        h = u[i][i] * g;
        for (j = l; j < mOrN; j++) {
          s = 0;
          for (k = l; k < m; k++) {
            s += u[k][i] * u[k][j];
          }
          f = s / h;
          for (k = i; k < m; k++) {
            u[k][j] = u[k][j] + f * u[k][i];
          }
        }
        for (j = i; j < m; j++) {
          u[j][i] = u[j][i] / g;
        }
      } else {
        for (j = i; j < m; j++) {
          u[j][i] = 0;
        }
      }
      u[i][i] = u[i][i] + 1;
    }
  }

  eps = eps * x;
  let converged;
  for (k = n - 1; k >= 0; k--) {
    for (let iteration = 0; iteration < 50; iteration++) {
      converged = false;
      for (l = k; l >= 0; l--) {
        if (Math.abs(e[l]) <= eps) {
          converged = true;
          break;
        }
        if (Math.abs(q[l - 1]) <= eps) {
          break;
        }
      }

      if (!converged) {
        c = 0;
        s = 1;
        l1 = l - 1;
        for (i = l; i < k + 1; i++) {
          f = s * e[i];
          e[i] = c * e[i];
          if (Math.abs(f) <= eps) {
            break;
          }
          g = q[i];
          q[i] = Math.sqrt(f * f + g * g);
          h = q[i];
          c = g / h;
          s = -f / h;
          if (withu) {
            for (j = 0; j < m; j++) {
              y = u[j][l1];
              z = u[j][i];
              u[j][l1] = y * c + (z * s);
              u[j][i] = -y * s + (z * c);
            }
          }
        }
      }

      z = q[k];
      if (l === k) {
        if (z < 0) {
          q[k] = -z;
          if (withv) {
            for (j = 0; j < n; j++) {
              v[j][k] = -v[j][k];
            }
          }
        }
        break;
      }

      x = q[l];
      y = q[k - 1];
      g = e[k - 1];
      h = e[k];
      f = ((y - z) * (y + z) + (g - h) * (g + h)) / (2 * h * y);
      g = Math.sqrt(f * f + 1);
      f = ((x - z) * (x + z) + h * (y / (f < 0 ? (f - g) : (f + g)) - h)) / x;

      c = 1;
      s = 1;
      for (i = l + 1; i < k + 1; i++) {
        g = e[i];
        y = q[i];
        h = s * g;
        g = c * g;
        z = Math.sqrt(f * f + h * h);
        e[i - 1] = z;
        c = f / z;
        s = h / z;
        f = x * c + g * s;
        g = -x * s + g * c;
        h = y * s;
        y = y * c;
        if (withv) {
          for (j = 0; j < n; j++) {
            x = v[j][i - 1];
            z = v[j][i];
            v[j][i - 1] = x * c + z * s;
            v[j][i] = -x * s + z * c;
          }
        }
        z = Math.sqrt(f * f + h * h);
        q[i - 1] = z;
        c = f / z;
        s = h / z;
        f = c * g + s * y;
        x = -s * g + c * y;
        if (withu) {
          for (j = 0; j < m; j++) {
            y = u[j][i - 1];
            z = u[j][i];
            u[j][i - 1] = y * c + z * s;
            u[j][i] = -y * s + z * c;
          }
        }
      }
      e[l] = 0;
      e[k] = f;
      q[k] = x;
    }
  }

  for (i = 0; i < n; i++) {
    if (q[i] < eps) q[i] = 0;
  }

  return [u, q, v];
}