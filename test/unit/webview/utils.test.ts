import { expect } from 'chai';
import { ColorPalette, hexToRgb } from '../../../webview/utils';

suite('webview.utils.ColorPalette', () => {
  test('full palette', async () => {
    const palette = new ColorPalette(
      "color", "ColorPalette",
      {
        [-1]: hexToRgb('#0000FFFF'),
        [0]:  hexToRgb('#FFFFFFFF'),
        [1]:  hexToRgb('#FF0000FF')
      }
    );
    expect(palette.getColor(-1)).to.deep.equal([0, 0, 255, 255]);
    expect(palette.getColor(0)).to.deep.equal([255, 255, 255, 255]);
    expect(palette.getColor(1)).to.deep.equal([255, 0, 0, 255]);
  });
  test('thresholded palette', async () => {
    const palette = new ColorPalette(
      "color", "ColorPalette",
      {
        [-0.5]: hexToRgb('#0000FFFF'),
        [0]:  hexToRgb('#FFFFFFFF'),
        [0.5]:  hexToRgb('#FF0000FF')
      }
    );
    expect(palette.getColor(-1)).to.deep.equal([0, 0, 0, 0]);
    expect(palette.getColor(-0.5)).to.deep.equal([0, 0, 255, 255]);
    expect(palette.getColor(0)).to.deep.equal([255, 255, 255, 255]);
    expect(palette.getColor(0.5)).to.deep.equal([255, 0, 0, 255]);
    expect(palette.getColor(1)).to.deep.equal([0, 0, 0, 0]);
  });
  test('thresholded palette, symmetric', async () => {
    const palette = new ColorPalette(
      "color", "ColorPalette",
      {
        [0.5]:  hexToRgb('#000000FF'),
        [0.75]:  hexToRgb('#FFFFFFFF')
      }
    );
    expect(palette.getColor(-1)).to.deep.equal([0, 0, 0, 0]);
    expect(palette.getColor(-0.5)).to.deep.equal([0, 0, 0, 0]);
    expect(palette.getColor(0)).to.deep.equal([0, 0, 0, 0]);
    expect(palette.getColor(0.5)).to.deep.equal([0, 0, 0, 255]);
    expect(palette.getColor(0.75)).to.deep.equal([255, 255, 255, 255]);
    expect(palette.getColor(1)).to.deep.equal([0, 0, 0, 0]);
  });
  test('asymm to symm palette', async () => {
    const palette = new ColorPalette(
      "color", "ColorPalette",
      {
        [-1]: hexToRgb('#0000FFFF'),
        [0]:  hexToRgb('#FFFFFFFF'),
        [1]:  hexToRgb('#FF0000FF')
      }
    );

    const symmPalette = palette.toSymmetric();
    expect(symmPalette.getIntervals()).to.deep.equal([ 0, 0.05, 1 ]);
    expect(symmPalette.getColor(0)).to.deep.equal([0, 0, 255, 255]);
    expect(symmPalette.getColor(0.05)).to.deep.equal([255, 255, 255, 255]);
    expect(symmPalette.getColor(1)).to.deep.equal([255, 0, 0, 255]);
  });
  test('symm to asymm palette', async () => {
    const palette = new ColorPalette(
      "color", "ColorPalette",
      {
        [0]:  hexToRgb('#FFFFFFFF'),
        [1]:  hexToRgb('#FF0000FF')
      }
    );

    const asymmPalette = palette.toAsymmetric();
    expect(asymmPalette.getIntervals()).to.deep.equal([ -1, 0, 1 ]);
    expect(asymmPalette.getColor(-1)).to.deep.equal([255, 0, 0, 255]);
    expect(asymmPalette.getColor(0)).to.deep.equal([255, 255, 255, 255]);
    expect(asymmPalette.getColor(1)).to.deep.equal([255, 0, 0, 255]);
  });
  test('move interval palette', async () => {
    const palette = new ColorPalette(
      "color", "ColorPalette",
      {
        [0]:  hexToRgb('#FFFFFFFF'),
        [0.5]:  hexToRgb('#FF8888FF'),
        [1]:  hexToRgb('#FF0000FF')
      }
    );

    const move1 = palette.moveInterval(0.5, 0.75)[1];
    expect(move1.getIntervals()).to.deep.equal([ 0, 0.75, 1 ]);
    expect(move1.getColor(0)).to.deep.equal([255, 255, 255, 255]);
    expect(move1.getColor(0.75)).to.deep.equal([255, 136, 136, 255]);
    expect(move1.getColor(1)).to.deep.equal([255, 0, 0, 255]);

    const move2 = palette.moveInterval(0.5, 1)[1];
    expect(move2.getIntervals()).to.deep.equal([ 0, 0.9999, 1 ]);
  });
});
