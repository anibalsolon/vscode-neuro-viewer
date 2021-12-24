import { DATA_TYPE_RANGE } from './constants';
import { NiftiImage } from './format';
import { scale, rgbToHex, ColorPalette } from '../utils';
import { EventEmitter } from '../events';

type SelectEvent = { from: number, to: number }
type PaletteEvent = { palette: ColorPalette; };

type EventType = "select" | "palette";
type EventArgs = SelectEvent | PaletteEvent;
type EventCallback<T> = (data: T) => void;

export class HistogramView extends EventEmitter<EventType, EventArgs> {

  el: {
    root: HTMLElement,
    bins?: HTMLElement,
    selection?: HTMLElement,
    currentSelection?: HTMLElement,
    thumbs?: HTMLElement,
  };

  image: NiftiImage;
  bins: number;
  binsRange: [number, number] = [-1, -1];
  binsCount: number[] = [];
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
  on(event: "palette", callback: EventCallback<PaletteEvent>): void;
  on(event: EventType, callback: any): void { // eslint-disable-line @typescript-eslint/no-explicit-any
    super.on(event, callback);
  }

  dispatch(event: "select", data: SelectEvent): void;
  dispatch(event: "palette", data: PaletteEvent): void;
  dispatch(event: EventType, data: EventArgs) {
    super.dispatch(event, data);
  }

  renderThumbs() {
    if (this.el.thumbs) {
      this.el.thumbs.remove();
    }

    this.el.thumbs = document.createElement('div');
    this.el.thumbs.classList.add('thumbs');

    const symmetric = this.binsRange[0] === 0;
    const binPercent = 100 / (this.bins + 2);
    this.palette.getIntervals().forEach((interval: number) => {
      if (!this.el.thumbs) {
        return;
      }

      const thumb = document.createElement('div');
      thumb.classList.add('thumb');
      thumb.style.setProperty('--main-color', rgbToHex(this.palette.getIntervalColor(interval)));
      thumb.setAttribute('data-index', interval.toString());

      const i = symmetric ? interval : (interval + 1) / 2;
      const bins = (1 - i) * this.bins;
      thumb.style.top = `${(bins + 1) * binPercent}%`;

      let containerRect = this.el.thumbs.getBoundingClientRect();
      let thumbRect = thumb.getBoundingClientRect();

      const mousemove = (e: MouseEvent) => {
        const thumbY = (e.clientY - containerRect.top - thumbRect.height / 2);
        let y = Math.max(0, Math.min(1, thumbY / containerRect.height));

        const interval = symmetric ? 1 - y : (y * -2) + 1;
        const oldInterval = +(thumb.getAttribute('data-index') || '0');
        let newInterval = interval;
        [newInterval, this.palette] = this.palette.moveInterval(oldInterval, interval);
        if (newInterval !== interval) {
          y = symmetric ? 1 - newInterval : (newInterval - 1) / -2;
        }

        thumb.setAttribute('data-index', newInterval.toString());
        thumb.style.top = `${y * 100}%`;
        this.dispatch('palette', { palette: this.palette });
        this._updateBackground();
      };
  
      const mouseup = (e: MouseEvent) => {
        document.removeEventListener('mousemove', mousemove);
        document.removeEventListener('mouseup', mouseup);
        mousemove(e);
      };
  
      const mousedown = () => {
        if (!this.el.thumbs) {
          return;
        }
        containerRect = this.el.thumbs.getBoundingClientRect();
        thumbRect = thumb.getBoundingClientRect();
        document.addEventListener('mousemove', mousemove);
        document.addEventListener('mouseup', mouseup);
      };
  
      thumb.addEventListener('mousedown', mousedown);

      this.el.thumbs.appendChild(thumb);
    });
    this.el.root.appendChild(this.el.thumbs);
  }

  renderSelector() {
    if (this.el.selection) {
      this.el.selection.remove();
    }
    const selectionEl = this.el.selection = document.createElement('div');
    this.el.selection.classList.add('selection');
    this.el.root.appendChild(this.el.selection);

    let rect: DOMRect | null = null;
    let clicked = false, moved = false;
    let rangeStart = -1, rangeEnd = -1, from = -1, to = -1;

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

  // Creates n+2 bins, where 2 are used for the borders
  binarize(): [[number, number], number[]] {
    const binsRange: [number, number] = [
      this.image.header.values.min < 0 ? -DATA_TYPE_RANGE: 0,
      DATA_TYPE_RANGE
    ];

    const valueToBin: { [key: number]: number } = {};
    let bin = 0;
    for (let i = binsRange[0]; i <= binsRange[1]; i++) {
      bin = ~~scale(
        i,
        [binsRange[0], binsRange[1]],
        [0, this.bins - 1]
      );
      valueToBin[i] = bin;
    }

    let count: number[] = Array(this.bins + 2).fill(0);
    for (const v of this.image.data) {
      count[valueToBin[v] + 1] = (count[valueToBin[v] + 1] || 0) + 1;
    }

    // Remove count from zeroed voxels for max
    const zeroed = count[valueToBin[0] + 1] || 0;
    count[valueToBin[0] + 1] = 0;

    const max = Math.max.apply(null, count);
    count = count.map((c) => c / max);

    // Reintroduce the zero count
    count[valueToBin[0] + 1] = Math.min(zeroed / max, 1);
    return [binsRange, count];
  }

  renderBins() {
    if (this.el.bins) {
      this.el.bins.remove();
    }
    this.el.bins = document.createElement('div');
    this.el.bins.classList.add('bins');
    this.el.root.appendChild(this.el.bins);
    let html = '';
    this.binsCount.reverse().forEach((v, i) => {
      const bin = this.bins - i - 1;
      html += `
        <div
          data-bin="${bin}"
          style="width: ${(1 - v) * 100}%; ${v > 0 ? "min-width: 1px;" : ""}"
        ></div>`;
    });
    this.el.bins.innerHTML = html;
    this._updateBackground();
  }

  render() {
    [this.binsRange, this.binsCount] = this.binarize();
    this.renderBins();
    this.renderSelector();
    this.renderThumbs();
  }

  update() {
    if (!this.el.bins) {
      return;
    }
    this._updateBackground();
    this.renderThumbs();
  }

  _updateBackground() {
    if (this.el.bins) 
      this.el.bins.style.background = this.palette.getGradient(0);
  }

  _updateCurrentSelectionBackground() {
    if (this.el.currentSelection)
      this.el.currentSelection.style.background = this.highlightPalette.getGradient(0);
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
