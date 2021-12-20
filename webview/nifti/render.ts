import { NiftiHeader, NiftiImage } from "./format";
import { ColorPalette, scale } from "./utils";

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
    header.qOffset.x > 0 ? 1 : -1,
    header.qOffset.y > 0 ? 1 : -1,
    header.qOffset.z > 0 ? 1 : -1,
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

export class RenderViewLayer {
  protected image?: NiftiImage;
  
  protected canvas?: HTMLCanvasElement;
  protected ctx?: CanvasRenderingContext2D;
  protected data?: ImageData;

  private _rendering: number[] = [-1, -1, -1, -1];
  private _rendered: number[] = [-2, -2, -2, -2];

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
  }

  update(size?: {width: number, height: number}, slice?: number, axis?: number) {
    if (!this.image || !this.canvas || !this.ctx) {
      return;
    }
    if (slice === undefined) slice = this._rendered[2];
    if (axis === undefined) axis = this._rendered[3];
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

    if (this._rendered[0] != this._rendering[0] || this._rendered[1] != this._rendering[1]) {
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

    if (!this.data || this._rendered[0] != this._rendering[0] || this._rendered[1] != this._rendering[1]) {
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

  computeColor(value: number) {
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

  update(slice?: number, axis?: number) {
    const [width, height] = [this.el.root.clientWidth, this.el.root.clientHeight];
    this.layers.forEach(layer => layer.update({width, height}, slice, axis));
  }
}