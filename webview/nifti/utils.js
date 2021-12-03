import { DATA_TYPE_RANGE } from './constants';

export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(hex);
  let alpha = 255;
  if (result && result.length == 5 && result[4]) {
    alpha = parseInt(result[4], 16);
  }
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
    a: alpha,
  } : null;
}

export function rgbToHex({ r, g, b, a }) {
  const alpha = a ? (0x100 + (a << 0)).toString(16).slice(1) : '';
  return '#' + (0x1000000 + ((r << 16) | (g << 8) | (b << 0))).toString(16).slice(1) + alpha;
}

export function lerp(c1, c2, ratio) {
  if (ratio >= 1) {
    return c2;
  } else if (ratio <= -1) {
    return c1;
  } else  if (ratio <= 0) {
    [c1, c2] = [c2, c1];
    ratio = -ratio;
  }
  return {
    r: (c1.r + ((c2.r - c1.r) * ratio)) ^ 0,
    g: (c1.g + ((c2.g - c1.g) * ratio)) ^ 0,
    b: (c1.b + ((c2.b - c1.b) * ratio)) ^ 0,
    a: (c1.a + ((c2.a - c1.a) * ratio)) ^ 0,
  }
}

export function paletteRange(colors, n=DATA_TYPE_RANGE) {
  const indexes = Object.keys(colors).map(k => parseInt(k)).sort((a, b) => a - b);
  const map = {};
  let c = 1;
  for (let i = -n; i <= n; i++) {
    let ratio = i / n;
    while (c < indexes.length && indexes[c] < ratio) {
      c++;
    }
    const color = lerp(colors[indexes[c-1]], colors[indexes[c]], ratio);
    map[i] = color;
  }
  return map;
}

export function dynFixed(number, decimals) {
  return number.toFixed(decimals).replace(/^[\.0]+|[\.0]+$/g, '') || '0';
}

export function scale(value, from, to) {
  var scale = (to[1] - to[0]) / (from[1] - from[0]);
  var capped = Math.min(from[1], Math.max(from[0], value)) - from[0];
  return ~~(capped * scale + to[0]);
}