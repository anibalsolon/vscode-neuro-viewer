import { RenderView, PaletteRenderViewLayer, HighlightRenderViewLayer } from './render';
import { InfoView } from './info';
import { NavigationView } from './navigation';
import { message } from './message';
import { NiftiImage } from './format';
import { HistogramView } from './histogram';

import { palettes, PalettesView } from './palettes';
import './index.css';

function prepareRender(ws: string, uuid: string, image: NiftiImage) {

  const mainEl = document.getElementById('main');
  const navigationEl = document.getElementById('tools');
  const palettesEl = document.getElementById('palettes');
  const thumbnailEl = document.getElementById('thumbnail');
  const messageEl = document.getElementById('message');
  const histogramEl = document.getElementById('histogram');

  if (!mainEl || !navigationEl || !palettesEl || !thumbnailEl || !messageEl || !histogramEl) {
    return;
  }

  message(messageEl, 'Rendering');

  const symmetric = image.header.values.min >= 0;
  const palette = symmetric ? palettes.bw : palettes.bbr;
  const highlightPalette = palettes.highlight;

  const palettesView = new PalettesView(palettesEl, palette);

  const histogramView = new HistogramView(
    histogramEl,
    image,
    120,  // TODO infer from image
    palette,
    highlightPalette
  );
  const mainLayer = new HighlightRenderViewLayer(palette, highlightPalette);
  const thumbnailLayer = new PaletteRenderViewLayer(palette);

  histogramView.on('select', ({ from, to }) => {
    mainLayer.setHighlight([from, to]);
    mainLayer.update();
  });
  histogramView.on('palette', ({ palette }) => {
    mainLayer.setPalette(palette);
    mainLayer.update();

    thumbnailLayer.setPalette(palette);
    thumbnailLayer.update();
  });

  const navigationView = new NavigationView(
    navigationEl,
    image
  );
  const thumbnailView = new RenderView(
    thumbnailEl,
    image,
    [thumbnailLayer]
  );
  const renderView = new RenderView(
    mainEl,
    image,
    [mainLayer]
  );

  mainLayer.on('over', ({ position, value }) => {
    renderView.update(undefined, undefined, position, value);
  });
  mainLayer.on('out', () => {
    renderView.update(undefined, undefined, null, null);
  });
  window.addEventListener('wheel', (e) => {
    let el = e.target as HTMLElement;
    while (el && el !== document.body && el.parentElement) {
      if (el.id === 'palettes-popup') {
        return;
      }
      el = el.parentElement;
    }
    navigationView.setSliceDelta(Math.sign(e.deltaY));
  }, false);

  window.addEventListener('resize', () => {
    renderView.update();
  });

  navigationView.on('axis', ({ axis }) => {
    renderView.update(navigationView.getSlice(), axis);
  });
  navigationView.on('slice', ({ slice }) => {
    renderView.update(slice, navigationView.getAxis());
  });
  navigationView.on('thumbnailSlice', ({ slice }) => {
    thumbnailView.update(slice, navigationView.getAxis());
  });

  palettesView.on('palette', ({ palette }) => {
    if (symmetric) {
      palette = palette.toSymmetric();
    } else {
      palette = palette.toAsymmetric();
    }

    palettesView.setPalette(palette);
    histogramView.setPalette(palette);
    histogramView.update();

    mainLayer.setPalette(palette);
    mainLayer.update();

    thumbnailLayer.setPalette(palette);
    thumbnailLayer.update();
  });

  palettesView.render();
  renderView.render();
  thumbnailView.render();
  navigationView.render();
  histogramView.render();

  message(messageEl);
}

window.addEventListener('message', async (e) => {
  const { type, body } = e.data;
  switch (type) {
    case 'init':
      {
        const ws = body.ws;
        const uuid = body.uuid;
        const header = body.header;
        let data = body.data;

        const infoEl = document.getElementById('info');
        if (!infoEl) {
          return;
        }
        const infoView = new InfoView(infoEl, header);
        infoView.render();

        const messageEl = document.getElementById('message');
        if (messageEl == null) {
          return;
        }
        
        message(messageEl, 'Loading');

        if (!data) {
          const res = await fetch(`${ws}${uuid}`);
          const image = await res.arrayBuffer();
          data = new Int16Array(image);
        }
        prepareRender(ws, uuid, { header, data });
      }
      break;
  }
});
