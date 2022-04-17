import { NiftiHeader, NiftiImage } from "./format";
import { ColorPalette, dynFixed, scale } from "../utils";
import { EventEmitter } from "../events";

const rowscols = [
  { cols: 1, rows: 2 },
  { cols: 0, rows: 2 },
  { cols: 0, rows: 1 }
];

function getRowsCols(header: NiftiHeader, axis: number) {
  return {
    rows: header.dimensions[rowscols[axis].rows],
    cols: header.dimensions[rowscols[axis].cols],
    axis: header.dimensions[axis],
  };
}

function getAxesSteps(header: NiftiHeader, axis: number) {
  const { cols, axis: axes } = getRowsCols(header, 1);

  const direction = [
    header.orientation[0] * -1,
    header.orientation[1],
    header.orientation[2] * -1,
  ];

  const steps = [
    1,
    cols,
    cols * axes,
  ];

  const rowscolsaxis = rowscols[axis];
  return {
    rows_step: steps[rowscolsaxis.rows] * direction[rowscolsaxis.rows],
    cols_step: steps[rowscolsaxis.cols] * direction[rowscolsaxis.cols],
    axis_step: steps[axis],
  };
}

type OverEvent = { position: [number, number, number], value: number };
type OutEvent = Record<string, never>;

type EventType = "over" | "out";
type EventArgs = OverEvent | OutEvent;
type EventCallback<T> = (data: T) => void;

export class RenderViewLayer extends EventEmitter<EventType, EventArgs> {
  protected image?: NiftiImage;
  
  protected canvas?: HTMLCanvasElement;
  protected ctx?: CanvasRenderingContext2D;
  protected data?: ImageData;

  protected _rendering: number[] = [-1, -1, -1, -1];
  protected _rendered: number[] = [-2, -2, -2, -2];
  protected _max = 0;

  on(event: "over", callback: EventCallback<OverEvent>): void;
  on(event: "out", callback: EventCallback<OutEvent>): void;
  on(event: EventType, callback: any): void { // eslint-disable-line @typescript-eslint/no-explicit-any
    super.on(event, callback);
  }

  dispatch(event: "over", data: OverEvent): void;
  dispatch(event: "out", data: OutEvent): void;
  dispatch(event: EventType, data: EventArgs) {
    super.dispatch(event, data);
  }

  render(root: HTMLElement, image: NiftiImage) {
    const el = document.createElement('canvas');
    const ctx = el.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2d context');
    }
    this.canvas = el;
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
    root.appendChild(el);
    this.image = image;
    this._max = Math.max(image.header.values.max, -image.header.values.min);

    let over = false;
    const mouseevent = (e: MouseEvent) => {
      if (!this.canvas || !this.image) {
        return;
      }
      if (e.type == 'mouseover') {
        over = true;
      } else if (e.type == 'mouseout') {
        over = false;
        this.dispatch('out', {});
      }
      if (!over) {
        return;
      }
      const { x: cx, y: cy, width: cw, height: ch } = this.canvas.getBoundingClientRect();
      const x = e.clientX - cx;
      const y = e.clientY - cy;
      const axis = this._rendered[3];
      const rowscolsaxis = rowscols[axis];
      const position: [number, number, number] = [0, 0, 0];
      const { cols, rows } = getRowsCols(this.image.header, axis);
      position[rowscolsaxis.cols] = Math.max(0, Math.min(cols - 1, Math.floor(x * cols / cw)));
      position[rowscolsaxis.rows] = Math.max(0, Math.min(rows - 1, Math.floor(y * rows / ch)));
      position[axis] = this._rendered[2];

      const value = this.computeOverValue(position);
      if (value !== null) {
        this.dispatch('over', { position: position, value: value.value });
      }
    };

    this.canvas.addEventListener('mouseover', mouseevent);
    this.canvas.addEventListener('mousemove', mouseevent);
    this.canvas.addEventListener('mouseout', mouseevent);
  }

  update(size?: {width: number, height: number}, slice?: number, axis?: number) {
    if (!this.image || !this.canvas || !this.ctx) {
      return;
    }
    if (slice === undefined) slice = this._rendered[2] || 0;
    if (axis === undefined) axis = this._rendered[3];
    if (slice < 0 || axis < 0) {
      return;
    }
    const { cols, rows } = getRowsCols(this.image.header, axis);
    const axesSteps = getAxesSteps(this.image.header, axis);
    let { cols_step, rows_step } = axesSteps;

    const voxels = this.image.header.pixelSizes;
    const imageWidth =  cols * (voxels[rowscols[axis].cols] / voxels[rowscols[axis].rows]);
    const imageHeight = rows * (voxels[rowscols[axis].rows] / voxels[rowscols[axis].cols]);

    this._rendering[0] = cols;
    this._rendering[1] = rows;
    this._rendering[2] = slice;
    this._rendering[3] = axis;

    if (this._rendered[0] != this._rendering[0] ||
        this._rendered[1] != this._rendering[1]) {
      this.canvas.width = cols;
      this.canvas.height = rows;
    }

    if (size) {
      const { width, height } = size;
      let [resizedWidth, resizedHeight] = [width, rows * width / imageWidth];
      if (resizedHeight > height) {
        resizedHeight = height;
        resizedWidth = cols * height / imageHeight;
      }

      const css = {
        width: Math.round(resizedWidth),
        height: Math.round(resizedHeight),
        top: Math.round(height / 2 -  resizedHeight / 2),
        left: Math.round(width / 2 -  resizedWidth / 2),
      };
      this.canvas.style.width = `${css.width}px`;
      this.canvas.style.height = `${css.height}px`;
      this.canvas.style.top = `${css.top}px`;
      this.canvas.style.left = `${css.left}px`;
    }

    if (!this.data ||
        this._rendered[0] != this._rendering[0] ||
        this._rendered[1] != this._rendering[1]) {
      this.data = this.ctx.createImageData(cols, rows);
    }

    if (this.shouldRedraw()) {
      const stepY = 1, stepX = 1; // TODO adaptive based on image size
      let row, col;
      let tzy_offset, tzyx_offset, image_offset;
    
      const x_positive = cols_step > 0;
      const y_positive = rows_step > 0;
      cols_step = Math.abs(cols_step);
      rows_step = Math.abs(rows_step);

      const tz_offset = slice * axesSteps.axis_step;
      for (row = 0; row < rows; row += 1) {
        tzy_offset = tz_offset + (y_positive ? row * stepY : rows - row * stepY - 1) * rows_step;
        for (col = 0; col < cols; col += 1) {
          tzyx_offset = tzy_offset + (x_positive ? col * stepX : cols - col * stepX - 1) * cols_step;
          image_offset = (row * (cols * 4) + col * 4);
    
          const value = this.image.data[tzyx_offset];
          const c = this.computeColor(value);
          this.data.data[image_offset + 0] = c[0];
          this.data.data[image_offset + 1] = c[1];
          this.data.data[image_offset + 2] = c[2];
          this.data.data[image_offset + 3] = c[3];
        }
      }
      this.ctx.putImageData(this.data, 0, 0);
    }

    this._rendered[0] = this._rendering[0];
    this._rendered[1] = this._rendering[1];
    this._rendered[2] = this._rendering[2];
    this._rendered[3] = this._rendering[3];
  }

  shouldRedraw() {
    return this._rendered[2] != this._rendering[2] || this._rendered[3] != this._rendering[3];
  }

  computeOverValue(position: [number, number, number]): { value: number, bin: number } | null {
    if (!this.image) {
      return null;
    }

    // TODO This can be cleaned up
    const axis = this._rendered[3];
    const { cols, rows } = getRowsCols(this.image.header, axis);
    const axesSteps = getAxesSteps(this.image.header, axis);
    let { cols_step, rows_step } = axesSteps;
    const stepY = 1, stepX = 1; // TODO adaptive based on image size
    const cols_positive = cols_step > 0;
    const rows_positive = rows_step > 0;
    cols_step = Math.abs(cols_step);
    rows_step = Math.abs(rows_step);
    const rowscolsaxis = rowscols[axis];

    let offset = position[axis] * axesSteps.axis_step;
    offset += (rows_positive ? position[rowscolsaxis.rows] * stepY : rows - position[rowscolsaxis.rows] * stepY - 1) * rows_step;
    offset += (cols_positive ? position[rowscolsaxis.cols] * stepX : cols - position[rowscolsaxis.cols] * stepX - 1) * cols_step;
    const value = (this.image.data[offset] / 32767) * this._max; // TODO abstract constant
    return { value, bin: this.image.data[offset] };
  }

  computeColor(value: number) {
    const scaled = Math.round(value / 8355585);
    return [scaled, scaled, scaled, 255];
  }
}

export class PaletteRenderViewLayer extends RenderViewLayer {
  protected palette: ColorPalette;
  protected _dirty = true;

  constructor(palette: ColorPalette) {
    super();
    this.palette = palette;
  }

  shouldRedraw(): boolean {
    const should = super.shouldRedraw() || this._dirty;
    this._dirty = false;
    return should;
  }

  setPalette(palette: ColorPalette) {
    this.palette = palette;
    this._dirty = true;
  }

  computeColor(value: number) {
    return this.palette.getColor(value / 32767);
  }
}

export class HighlightRenderViewLayer extends PaletteRenderViewLayer {
  private _highlight: [number, number] = [-1, -1];
  protected highlightPalette: ColorPalette;

  constructor(palette: ColorPalette, highlightPalette: ColorPalette) {
    super(palette);
    this.highlightPalette = highlightPalette;
  }

  shouldRedraw(): boolean {
    const should = super.shouldRedraw() || this._dirty;
    this._dirty = false;
    return should;
  }

  setHighlight(highlight: [number, number]) {
    this._highlight = highlight;
    this._dirty = true;
  }

  computeOverValue(position: [number, number, number]): { value: number, bin: number } | null {
    // TODO dont use -1, but null
    const value = super.computeOverValue(position);
    if (value) {
      if (this._highlight[0] == -1 && this._highlight[1] == -1) {
        return value;
      }
      if (value.bin >= this._highlight[0] && value.bin < this._highlight[1]) {
        return value;
      }
    }
    return null;
  }

  computeColor(value: number) {
    // TODO dont use -1, but null
    if (this._highlight[0] == -1 && this._highlight[1] == -1) {
      return this.palette.getColor(value / 32767);
    }
    if (value >= this._highlight[0] && value < this._highlight[1]) {
      value = scale(value, this._highlight, [0, 1]);
      return this.highlightPalette.getColor(value);
    }
    return this.palette.getColor((value / 32767) * 1/10);
  }
}

export class RenderView {
  el: { 
    root: HTMLElement,
  };
  image: NiftiImage;
  layers: RenderViewLayer[];

  _size: [number, number] = [-1, -1];

  constructor(el: HTMLElement, image: NiftiImage, layers: RenderViewLayer[]) {
    this.el = {
      root: el,
    };
    this.image = image;
    this.layers = layers;
  }

  render() {
    this.layers.forEach((layer) => {
      layer.render(this.el.root, this.image);
    });
  }

  // TODO consider using an object for args? or a new type
  update(slice?: number, axis?: number, position?: [number, number, number] | null, value?: number | null) {
    const [width, height] = [this.el.root.clientWidth, this.el.root.clientHeight];
    if ((slice !== undefined && axis !== undefined) || this._size[0] != width || this._size[1] != height) {
      this.layers.forEach(layer => layer.update({width, height}, slice, axis));
      this._size[0] = width;
      this._size[1] = height;
    }
    if (position !== undefined) {
      if (position !== null) {
        this.el.root.setAttribute('data-position', `${position[0] + 1},${position[1] + 1},${position[2] + 1}`);
        if (value !== undefined && value !== null) {
          const rounded = Math.round(value);
          this.el.root.setAttribute('data-value', Math.abs(value - rounded) < 0.01 ? rounded.toString() : dynFixed(value, 3));
        } else {
          this.el.root.removeAttribute('data-value');
        }
      } else {
        this.el.root.removeAttribute('data-position');
        this.el.root.removeAttribute('data-value');
      }
    }
  }
}