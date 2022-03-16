export type Color = [number, number, number, number];
export type ColorIntervals = {[key: number]: Color}; // TODO do not store as map, but two arrays

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
  ];
}

export class ColorPalette {
  private id: string;
  private name: string;
  private intervals: number[];
  private palette: ColorIntervals;
  private symmetric: boolean;

  constructor(id: string, name: string, colorIntervals: ColorIntervals, symmetric?: boolean) {
    this.id = id;
    this.name = name;
    this.intervals = [];
    this.palette = {};
    this.symmetric = true;
    this.updateInvervals(colorIntervals, symmetric);
  }

  public getId(): string {
    return this.id;
  }

  public getName(): string {
    return this.name;
  }

  public getGradient(deg: number): string {
    let gradient = `linear-gradient(${deg}deg, `;
    const range = this.symmetric ? [0, 1] : [-1, 1];
    const adjustPercentage = (x: number) => (this.symmetric ? x : (x + 1) / 2) * 100;
    if (this.intervals[0] > range[0]) {
      const perc = adjustPercentage(this.intervals[0]);
      gradient += `#00000000 0% ${perc}%, `;
    }

    let perc = 0;
    this.intervals.forEach((i) => {
      perc = adjustPercentage(i);
      gradient += `${rgbToHex(this.palette[i])} ${perc}%, `;
    });

    if (this.intervals[this.intervals.length - 1] < 1) {
      gradient += `#00000000 ${perc}% 100%, `;
    }
    gradient = gradient.slice(0, -2);
    gradient += `)`;
    return gradient;
  }

  public getIntervals(): number[] {
    return this.intervals;
  }

  public getIntervalColor(interval: number): Color {
    return this.palette[interval];
  }

  public updateInvervals(colorIntervals: ColorIntervals, symmetric?: boolean): void {
    this.palette = colorIntervals;
    this.intervals = Object.keys(colorIntervals).map(k => +k).sort((a, b) => a - b);
    this.symmetric = symmetric !== undefined ? symmetric : this.intervals[0] >= 0;
  }

  public moveInterval(interval: number, newInterval: number): [number, ColorPalette] {
    if (interval === newInterval) {
      return [newInterval, this];
    }
    const palette = {...this.palette};
    const color = palette[interval];
    delete palette[interval];

    let modifier = 4;
    let tries = this.intervals.length;
    while (this.intervals.includes(newInterval) && tries > 0 && modifier > 1) {
      newInterval += (newInterval > interval ? -1 : 1) * (1 / (10 ** modifier));
      tries--;
      if (tries === 0) {
        modifier--;
        tries = this.intervals.length;
      }
    }
    return [
      newInterval,
      new ColorPalette(this.id, this.name, {...palette, [newInterval]: color}, this.symmetric)
    ];
  }

  public getColor(ratio: number): Color {
    ratio = Math.max(-1, Math.min(1, ratio));
    if (this.intervals.includes(ratio)) {
      return this.palette[ratio];
    }

    let c = 0;
    while (c < this.intervals.length && this.intervals[c] <= ratio) {
      c++;
    }
    if (c === 0) {
      return this.palette[this.intervals[0]];
    } else if (c === this.intervals.length) {
      return this.palette[this.intervals[this.intervals.length - 1]];
    }
    const s = scale(
      ratio,
      [this.intervals[c - 1], this.intervals[c]],
      [0, 1]
    );
    const color = ratio < 0 ? 
      lerp(
        this.palette[this.intervals[c]],
        this.palette[this.intervals[c-1]],
        1 - s
      ) :
      lerp(
        this.palette[this.intervals[c-1]],
        this.palette[this.intervals[c]],
        s
      );
    return color;
  }

  public getSymmetric(): boolean {
    return this.symmetric;
  }

  public toSymmetric(): ColorPalette {
    if (this.symmetric) {
      return this;
    }
    const flipAtIdx = this.intervals.findIndex((n) => n >= 0);
    let flipAt = this.intervals[flipAtIdx];
    if (flipAt === 0) {
      // Brings zero to positives, just a bit
      flipAt = (this.intervals[flipAtIdx] + this.intervals[flipAtIdx + 1]) / 20;
    }
    const intervals = this.intervals.map(
      i => i <= 0 ? 
        [i, scale(
          i,
          [this.intervals[0], this.intervals[flipAtIdx]],
          [0, flipAt]
        )]:
        [i, i]
    );
    const palette: ColorIntervals = {};
    for (const [oi, ni] of intervals) {
      palette[ni] = this.palette[oi];
    }
    return new ColorPalette(this.id, this.name, palette);
  }

  public toAsymmetric(): ColorPalette {
    if (!this.symmetric) {
      return this;
    }
    const palette = {...this.palette};
    for (const i of this.intervals) {
      if (i > 0) {
        palette[-i] = palette[i];
      }
    }
    return new ColorPalette(this.id, this.name, palette);
  }
}

export function dynFixed(number: number, decimals: number) {
  const factor = Math.pow(10, decimals);
  return (Math.round(number * factor) / factor).toString().replace(/^[.0]+|[.0]+$/g, '') || '0';
}

export function scale(value: number, from: [number, number], to: [number, number]): number {
  const scale = (to[1] - to[0]) / (from[1] - from[0]);
  const capped = Math.min(from[1], Math.max(from[0], value)) - from[0];
  return capped * scale + to[0];
}