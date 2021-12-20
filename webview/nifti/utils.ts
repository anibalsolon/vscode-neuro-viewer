export type Color = [number, number, number, number];
export type ColorIntervals = {[key: number]: Color};

export function hexToRgb(hex: string): Color {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(hex);
  let alpha = 255;
  if (result && result.length == 5 && result[4]) {
    alpha = parseInt(result[4], 16);
  }
  if (result) {
    return [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16),
      alpha,
    ];
  }

  throw new Error(`Invalid hex color: ${hex}`);
}

export function rgbToHex([r, g, b, a]: Color): string {
  const alpha = a ? (0x100 + (a << 0)).toString(16).slice(1) : '';
  return '#' + (0x1000000 + ((r << 16) | (g << 8) | (b << 0))).toString(16).slice(1) + alpha;
}

export function lerp(c1: Color, c2: Color, ratio: number): Color {
  if (ratio >= 1) {
    return c2;
  } else if (ratio < 0) {
    return c1;
  }
  return [
    (c1[0] + ((c2[0] - c1[0]) * ratio)) ^ 0,
    (c1[1] + ((c2[1] - c1[1]) * ratio)) ^ 0,
    (c1[2] + ((c2[2] - c1[2]) * ratio)) ^ 0,
    (c1[3] + ((c2[3] - c1[3]) * ratio)) ^ 0,
  ]
}

export class ColorPalette {
  private intervals: number[];
  private palette: ColorIntervals;
  private symmetric: boolean;

  constructor(colorIntervals: ColorIntervals) {
    const indexes = Object.keys(colorIntervals).map(k => parseInt(k)).sort((a, b) => a - b);
    this.symmetric = indexes[0] >= 0;
    this.palette = colorIntervals;
    this.intervals = indexes;
  }

  getColor(ratio: number): Color {
    if (this.symmetric) {
      ratio = Math.max(0, Math.min(1, ratio));
      if (ratio == 0) {
        return this.palette[this.intervals[0]];
      }
    } else {
      ratio = Math.max(-1, Math.min(1, ratio));
      if (ratio == -1) {
        return this.palette[this.intervals[0]];
      }
    }
    if (ratio == 1) {
      return this.palette[this.intervals[this.intervals.length - 1]];
    }

    let c = 1;
    while (c < this.intervals.length && this.intervals[c] <= ratio) {
      c++;
    }
    const color = ratio < 0 ? 
      lerp(
        this.palette[this.intervals[c]],
        this.palette[this.intervals[c-1]],
        Math.abs(ratio)
      ) :
      lerp(
        this.palette[this.intervals[c-1]],
        this.palette[this.intervals[c]],
        ratio
      );
    return color;
  }
}

export function dynFixed(number: number, decimals: number) {
  return number.toFixed(decimals).replace(/^[.0]+|[.0]+$/g, '') || '0';
}

export function scale(value: number, from: [number, number], to: [number, number]): number {
  const scale = (to[1] - to[0]) / (from[1] - from[0]);
  const capped = Math.min(from[1], Math.max(from[0], value)) - from[0];
  return capped * scale + to[0];
}