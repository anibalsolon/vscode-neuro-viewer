import { DATA_TYPE_RANGE } from './constants';
import { NiftiImage } from './format';
import { scale, rgbToHex, Color, ColorPalette } from '../utils';
import { EventEmitter } from '../events';

type SelectEvent = { from: number, to: number }

type EventType = "select";
type EventArgs = SelectEvent;
type EventCallback<T> = (data: T) => void;

export class HistogramView extends EventEmitter<EventType, EventArgs> {

  el: {
    root: HTMLElement,
    bins?: HTMLElement,
    selection?: HTMLElement,
    currentSelection?: HTMLElement,
  };

  image: NiftiImage;
  bins: number;
  binsRange: [number, number] = [-1, -1];
  palette: ColorPalette;
  highlightPalette: ColorPalette;

  constructor(el: HTMLElement, image: NiftiImage, bins: number, palette: ColorPalette, highlightPalette: ColorPalette) {
    super();
    this.el = {
      root: el,
    };

    this.image = image;
    this.bins = ~~bins;
    if (this.bins % 2 === 0) {
      this.bins++;
    }
    this.palette = palette;
    this.highlightPalette = highlightPalette;
  }

  getPalette() {
    return this.palette;
  }

  setPalette(palette: ColorPalette) {
    this.palette = palette;
  }

  getHighlightPalette() {
    return this.highlightPalette;
  }

  setHighlightPalette(palette: ColorPalette) {
    this.highlightPalette = palette;
  }

  on(event: "select", callback: EventCallback<SelectEvent>): void;
  on(event: EventType, callback: any): void { // eslint-disable-line @typescript-eslint/no-explicit-any
    super.on(event, callback);
  }

  dispatch(event: "select", data: SelectEvent): void;
  dispatch(event: EventType, data: EventArgs) {
    super.dispatch(event, data);
  }

  render() {
    this.el.bins = document.createElement('div');
    this.el.bins.classList.add('bins');
    this.el.selection = document.createElement('div');
    this.el.selection.classList.add('selection');

    this.setHighlightPalette(this.highlightPalette);

    this.el.root.appendChild(this.el.bins);
    this.el.root.appendChild(this.el.selection);

    this.binsRange = [
      this.image.header.values.min < 0 ? -DATA_TYPE_RANGE: 0,
      DATA_TYPE_RANGE
    ];

    const valueToBin: { [key: number]: number } = {};
    const binColor: { [key: number]: Color } = {};
    let bin = 0,
      prevBin = 0;

    for (let i = this.binsRange[0]; i <= this.binsRange[1]; i++) {
      bin = ~~scale(
        i,
        [this.binsRange[0], this.binsRange[1]],
        [0, this.bins - 1]
      );
      valueToBin[i] = bin;
      if (bin !== prevBin) {
        binColor[prevBin] = this.palette.getColor(
          i / DATA_TYPE_RANGE
        );
        prevBin = bin;
      }
    }
    binColor[bin] = this.palette.getColor(1.0);

    let count = Array(this.bins).fill(0);
    for (const v of this.image.data) {
      count[valueToBin[v]] = (count[valueToBin[v]] || 0) + 1;
    }
    const zeroed = count[valueToBin[0]] || 0;
    count[valueToBin[0]] = 0;

    const max = Math.max.apply(null, count);
    count = count.map((c) => c / max);
    count[valueToBin[0]] = Math.min(zeroed / max, 1);

    let html = '';
    count.reverse().forEach((v, i) => {
      const bg = rgbToHex(binColor[this.bins - i - 1]);
      html += `
        <div
          data-bin="${this.bins-i-1}"
          style="width: ${v * 100}%; ${v > 0 ? "min-width: 1px;" : ""} background: ${bg}"
        ></div>`;
    });
    this.el.bins.innerHTML = html;
    this.el.bins.style.backgroundColor = rgbToHex(this.palette.getColor(0));

    let rect: DOMRect | null = null;
    let clicked = false, moved = false;
    let rangeStart = -1, rangeEnd = -1, from = -1, to = -1;

    const selectionEl = this.el.selection;

    const mousemove = (e: MouseEvent) => {
      if (!rect) {
        return;
      }
      const y = e.clientY - rect.top;
      rangeEnd = y / rect.height;

      from = 1 - Math.min(1, rangeEnd < rangeStart ? rangeStart : rangeEnd);
      to = 1 - Math.max(0, rangeEnd > rangeStart ? rangeStart : rangeEnd);

      if (this.el.currentSelection) {
        this.el.currentSelection.style.top = `${(1 - to) * 100}%`;
        this.el.currentSelection.style.bottom = `${from * 100}%`;
      }

      if (from != to) {
        this.dispatchRange(from, to);
      }
      moved = true;
    };

    const mouseup = (e: MouseEvent) => {
      document.removeEventListener('mousemove', mousemove);
      document.removeEventListener('mouseup', mouseup);

      if (from == to || !moved) {
        this.el.currentSelection?.remove();
        delete this.el.currentSelection;
        this.dispatchRange(-1, -1);
      }

      if (!clicked)
        return;
      clicked = false;
      mousemove(e);
    };

    const mousedown = (e: MouseEvent) => {
      moved = false;

      this.el.currentSelection?.remove();
      this.el.currentSelection = document.createElement('div');
      selectionEl.appendChild(this.el.currentSelection);
      this._updateCurrentSelectionBackground();

      rect = selectionEl.getBoundingClientRect();
      const y = e.clientY - rect.top;
      rangeStart = y / rect.height;

      clicked = true;

      document.addEventListener('mousemove', mousemove);
      document.addEventListener('mouseup', mouseup);
    };

    selectionEl.addEventListener('mousedown', mousedown);
  }

  _updateCurrentSelectionBackground() {
    if (this.el.currentSelection)
      this.el.currentSelection.style.background = 
        `linear-gradient(0deg, ${rgbToHex(this.highlightPalette.getColor(0))} 0%, ${rgbToHex(this.highlightPalette.getColor(1))} 100%)`;
  }

  dispatchRange(from: number, to: number) {
    this.dispatch('select', {
      from: from == -1 ? -1 : ~~scale(
        from,
        [0, 1],
        this.binsRange
      ),
      to: to == -1 ? -1 : ~~scale(
        to,
        [0, 1],
        this.binsRange
      ),
    });
  }

}
