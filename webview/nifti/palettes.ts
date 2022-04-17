import { EventEmitter } from '../events';
import { hexToRgb, ensureHex, ColorPalette } from '../utils';

const documentElement = getComputedStyle(document.documentElement);

export const colors = {
  light: hexToRgb(ensureHex('rgba(89, 152, 192, 0.93)')),
  dark: hexToRgb(ensureHex(documentElement.getPropertyValue('--vscode-editor-background'))),
  highlight: hexToRgb(ensureHex(documentElement.getPropertyValue('--vscode-minimap-findMatchHighlight'))),
};

export const palettes = {
  'bwr': new ColorPalette(
    'bwr',
    'Blue White Red',
    {
      [-1]: hexToRgb('#0000FFFF'),
      [0]:  hexToRgb('#FFFFFFFF'),
      [1]:  hexToRgb('#FF0000FF')
    }
  ),
  'bbr': new ColorPalette(
    'bbr',
    'Blue Black Red',
    {
      [-1]: hexToRgb('#0000FFFF'),
      [0]:  hexToRgb('#000000FF'),
      [1]:  hexToRgb('#FF0000FF')
    }
  ),
  'bw': new ColorPalette(
    'bw',
    'Black & White',
    {
      [0]: hexToRgb('#000000FF'),
      [1]: hexToRgb('#FFFFFFFF')
    }
  ),
  'highlight': new ColorPalette(
    'highlight',
    'Highlight',
    {
      [0]: colors.highlight,
      [1]: hexToRgb('#FFFFFFFF')
    }
  ),
};


type OpenEvent = Record<string, never>;
type CloseEvent = Record<string, never>;
type PaletteEvent = { palette: ColorPalette; };

type EventType = "open" | "close" | "palette";
type EventArgs = OpenEvent | CloseEvent | PaletteEvent;
type EventCallback<T> = (data: T) => void;

export class PalettesView extends EventEmitter<EventType, EventArgs> {

  el: { 
    root: HTMLElement,
    button: HTMLElement,
    popup: HTMLElement
  };

  palette: ColorPalette;

  constructor(el: HTMLElement, palette: ColorPalette) {
    super();
    this.el = {
      root: el,
      button: el.children[0] as HTMLElement,
      popup: el.children[1] as HTMLElement,
    };
    this.palette = palette;
  }

  on(event: "open", callback: EventCallback<OpenEvent>): void;
  on(event: "close", callback: EventCallback<CloseEvent>): void;
  on(event: "palette", callback: EventCallback<PaletteEvent>): void;
  on(event: EventType, callback: any): void { // eslint-disable-line @typescript-eslint/no-explicit-any
    super.on(event, callback);
  }

  dispatch(event: "open", data: OpenEvent): void;
  dispatch(event: "close", data: CloseEvent): void;
  dispatch(event: "palette", data: PaletteEvent): void;
  dispatch(event: EventType, data: EventArgs) {
    super.dispatch(event, data);
  }

  render() {
    Object.values(palettes).forEach(palette => {
      const el = document.createElement('div');
      el.setAttribute('data-id', palette.getId());
      el.setAttribute('data-name', palette.getName());
      el.style.background = palette.getGradient(90);
      el.addEventListener('click', (e) => {
        this.palette = palette;
        this.el.popup.classList.remove('open');

        const elements: Element[] = Array.from(this.el.popup.children);
        elements.forEach((el: Element) => {
          (el as HTMLElement).removeAttribute('data-selected');
        });
        (e.target as HTMLElement).setAttribute('data-selected', 'true');
        this.dispatch('palette', { palette });
      });

      if (palette.getId() === this.palette.getId()) {
        el.setAttribute('data-selected', 'true');
      }

      this.el.popup.appendChild(el);
    });

    this.el.button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.el.popup.classList.toggle('open');
      if (this.el.popup.classList.contains('open')) {
        const onClose = (e: MouseEvent) => {
          let el = e.target as HTMLElement;
          while (el && el !== document.body && el.parentElement) {
            if (el.id === 'palettes-popup') {
              return;
            }
            el = el.parentElement;
          }
          this.el.popup.classList.remove('open');
          document.removeEventListener('click', onClose);
          this.dispatch('close', {});
        };
        document.addEventListener('click', onClose);
        this.dispatch('open', {});
      }
    });
  }
  
  getPalette() {
    return this.palette;
  }

  setPalette(palette: ColorPalette) {
    this.palette = palette;
  }
}
