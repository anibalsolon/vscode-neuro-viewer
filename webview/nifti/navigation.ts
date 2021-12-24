import { EventEmitter } from "../events";
import { NiftiImage } from "./format";

type SliceEvent = { slice: number; }
type AxisEvent = { axis: number; }
type ThumbnailSliceEvent = { slice: number; }

type EventType = "slice" | "axis" | "thumbnailSlice";
type EventArgs = SliceEvent & AxisEvent & ThumbnailSliceEvent;
type EventCallback<T> = (data: T) => void;

export class NavigationView extends EventEmitter<EventType, EventArgs> {

  el: { 
    root: HTMLElement,
    axes: HTMLElement,
    axis: HTMLElement[],
    slicer: HTMLElement,
    slice: HTMLElement,
    range: HTMLElement,
    thumb: HTMLElement,
    thumbnail: HTMLElement,
  };
  
  image: NiftiImage;
  axis: number;
  slices: number[];
  selectedSlice: number[];

  constructor(el: HTMLElement, image: NiftiImage) {
    super();
    this.el = {
      root: el,
      axes: el.children[0] as HTMLElement,
      axis: [],
      slicer: el.children[1] as HTMLElement,
      slice: el.children[1].children[0] as HTMLElement,
      range: el.children[1].children[1] as HTMLElement,
      thumb: el.children[1].children[1].children[0] as HTMLElement,
      thumbnail: el.children[1].children[1].children[1] as HTMLElement,
    };
    this.image = image;
    this.axis = 0;
    this.slices = image.header.dimensions;
    this.selectedSlice = this.slices.map((s) => ~~(s / 2));
  }

  on(event: "slice", callback: EventCallback<SliceEvent>): void;
  on(event: "axis", callback: EventCallback<AxisEvent>): void;
  on(event: "thumbnailSlice", callback: EventCallback<ThumbnailSliceEvent>): void;
  on(event: EventType, callback: any): void { // eslint-disable-line @typescript-eslint/no-explicit-any
    super.on(event, callback);
  }

  dispatch(event: "slice", data: SliceEvent): void;
  dispatch(event: "axis", data: AxisEvent): void;
  dispatch(event: "thumbnailSlice", data: ThumbnailSliceEvent): void;
  dispatch(event: EventType, data: EventArgs) {
    super.dispatch(event, data);
  }

  render() {
    this.el.thumb.style.display = 'block';
    this.el.range.addEventListener('click', this.onPositioning.bind(this));
    this.el.range.addEventListener('mouseover', this.onThumbnailBrowsing.bind(this));
    this.el.range.addEventListener('mousemove', this.onThumbnailBrowsing.bind(this));
    this.el.range.addEventListener('mouseout', this.onThumbnailBrowsing.bind(this));

    const axesNames = ['X', 'Y', 'Z'];
    this.slices.map((d, i) => {
      if (i > 2 || d <= 1) {
        return;
      }
      const el = document.createElement('div');
      el.innerHTML = axesNames[i];
      el.setAttribute('data-axis', i.toString());
      el.addEventListener('click', () => this.setAxis(i), false);
      this.el.axes.appendChild(el);
      this.el.axis.push(el);
    });

    this.setAxis(this.axis);
    this.setSlice(this.selectedSlice[this.axis]);
  }

  onThumbnailBrowsing(e: HTMLElementEventMap['mouseover'] | HTMLElementEventMap['mousemove']| HTMLElementEventMap['mouseout']) {
    e.preventDefault();
    const boundingRect = this.el.range.getBoundingClientRect();
    const rangeRect = { height: boundingRect.height, top: boundingRect.top };
    const thumbRect = this.el.thumb.getBoundingClientRect();
    const thumbHeight = thumbRect.height / 2;
    rangeRect.height -= thumbRect.height;
    rangeRect.top += thumbHeight;
    const thumbnailHeight = this.el.thumbnail.clientHeight;

    switch (e.type) {
      case 'mousemove':
      case 'mouseover': {
        this.el.thumbnail.style.display = 'block';
        const y = Math.max(thumbHeight, e.clientY - rangeRect.top);
        const ratio = Math.min(1, Math.max(0, y / rangeRect.height));
        this.el.thumbnail.style.top = `${(y - (thumbnailHeight * ratio)) / rangeRect.height * 100}%`;

        const slices = this.slices[this.axis];
        const slice = Math.min(slices, Math.max(1, Math.round(slices * ratio))) - 1;
        this.dispatch('thumbnailSlice', { slice });
        break;
      }
      case 'mouseout': {
        if (e.relatedTarget != this.el.thumb){
          this.el.thumbnail.style.display = 'none';
        }
        break;
      }
    }
  }

  onPositioning(e: HTMLElementEventMap['click']) {
    e.preventDefault();
    const thumbRect = this.el.thumb.getBoundingClientRect();
    const rangeRect = this.el.range.getBoundingClientRect();
    const slices = this.slices[this.axis];
    const y = e.clientY - rangeRect.top - thumbRect.height / 2;
    const ratio = y / (rangeRect.height - thumbRect.height);
    const slice = Math.min(slices, Math.max(1, Math.round(slices * ratio))) - 1;
    this.setSlice(slice);
  }

  getAxis() {
    return this.axis;
  }

  setAxis(axis: number) {
    this.axis = axis;
    this.el.axis.map((el) => {
      if (el.getAttribute('data-axis') === axis.toString()) {
        el.setAttribute('data-selected', 'true');
      } else {
        el.removeAttribute('data-selected');
      }
    });

    this.dispatch('axis', { axis });
    this.setSlice(this.selectedSlice[this.axis]);
  }

  getSlice() {
    return this.selectedSlice[this.axis];
  }

  setSliceDelta(sliceDelta: number) {
    this.setSlice(this.selectedSlice[this.axis] + sliceDelta);
  }

  setSlice(slice: number) {
    if (slice < 0) {
      slice = this.slices[this.axis] - Math.abs(slice);
    } else if (slice >= this.slices[this.axis]) {
      slice = slice - this.slices[this.axis];
    }

    this.selectedSlice[this.axis] = slice;

    this.el.slice.innerText = (slice + 1).toString();
    const slices = this.slices[this.axis];
    const trueRange = (this.el.range.clientHeight - (this.el.thumb.clientHeight)) / this.el.range.clientHeight;
    const perc = (slice / (slices - 1)) * trueRange * 100;

    this.el.thumb.style.top = `${perc}%`;

    this.dispatch('slice', { slice });
  }
}
