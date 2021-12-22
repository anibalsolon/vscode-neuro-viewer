import { hexToRgb, ColorPalette } from '../utils';

const documentElement = getComputedStyle(document.documentElement);

export const colors = {
  light: hexToRgb(documentElement.getPropertyValue('--vscode-editor-foreground')),
  dark: hexToRgb(documentElement.getPropertyValue('--vscode-editor-background')),
  highlight: hexToRgb(documentElement.getPropertyValue('--vscode-minimap-findMatchHighlight')),
};

export const palettes = {
  'bwr': new ColorPalette({
    [-1]: hexToRgb('#0000FFFF'),
    [0]:  hexToRgb('#FFFFFFFF'),
    [1]:  hexToRgb('#FF0000FF')
  }),
  'bbr': new ColorPalette({
    [-1]: hexToRgb('#0000FFFF'),
    [0]:  hexToRgb('#000000FF'),
    [1]:  hexToRgb('#FF0000FF')
  }),
  'bw': new ColorPalette({
    [0]: hexToRgb('#000000FF'),
    [1]: hexToRgb('#FFFFFFFF')
  }),
  'highlight': new ColorPalette({
    [0]: colors.highlight,
    [1]: hexToRgb('#FFFFFFFF')
  }),
};
