import { NiftiHeader } from './format';
import { dynFixed } from '../utils';

export class InfoView {

  el: { 
    root: HTMLElement,
    dimensions: HTMLElement,
    voxelSize: HTMLElement,
    orientation: HTMLElement,
    dataType: HTMLElement,
    geometry: HTMLElement,
  };
  
  header: NiftiHeader;

  constructor(el: HTMLElement, header: NiftiHeader) {
    const table = el.children[0] as HTMLElement;
    this.el = {
      root: el,
      dimensions: table.children[1].children[0].children[0] as HTMLElement,
      voxelSize: table.children[1].children[0].children[1] as HTMLElement,
      orientation: table.children[1].children[0].children[2] as HTMLElement,
      dataType: table.children[1].children[0].children[3] as HTMLElement,
      geometry: table.children[3].children[0].children[0] as HTMLElement,
    };
    this.header = header;
  }

  render() {
    const header = this.header;
    const dims = header.dimensions;
    this.el.dimensions.innerHTML = `${dims.length}-D: [${dims.join(', ')}]`;
  
    this.el.voxelSize.innerHTML = header.voxelSize.map(
      (s, i) =>
        `${s}${i < 3 ? 'mm' : (i == 3 && dims[3] > 1 ? 's' : '')}`
    ).join(', ');
  
    this.el.geometry.innerHTML = 'MATRIX(' + header.affine.map(
      (l) => l.map((v) => dynFixed(-1 * v, 3)).join(',')
    ).join(',') + '):' + dims.join(',');
  
    this.el.orientation.innerHTML = dims.length < 3 ? '' : (
      `${header.qOffset.x > 0 ? 'R' : 'L'}` +
      `${header.qOffset.y > 0 ? 'A' : 'P'}` +
      `${header.qOffset.z > 0 ? 'S' : 'I'}`
    );
  
    this.el.dataType.innerHTML = `${header.dataType}`;
  }

  update(position?: [number, number, number], value?: number) {
    let str = '';
    if (position) {
      str += `[${position.map(i => i+1).join(', ')}]`;
      if (value) {
        str += `: ${dynFixed(value, 3)}`;
      }
    }
    this.el.geometry.innerHTML = str;
  }
}
