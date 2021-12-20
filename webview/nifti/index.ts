import { RenderView, PaletteRenderViewLayer, HighlightRenderViewLayer } from './render';
import { InfoView } from './info';
import { NavigationView } from './navigation';
import { message } from './message';
import { NiftiImage } from './format';
import { HistogramView } from './histogram';

import { palettes } from './palettes';

function prepareRender(ws: string, uuid: string, image: NiftiImage) {

  const mainEl = document.getElementById('main');
  const navigationEl = document.getElementById('tools');
  const thumbnailEl = document.getElementById('thumbnail');
  const messageEl = document.getElementById('message');
  const histogramEl = document.getElementById('histogram');

  if (!mainEl || !navigationEl || !thumbnailEl || !messageEl || !histogramEl) {
    return;
  }

  message(messageEl, 'Rendering');

  const symmetric = image.header.values.min < 0;
  const palette = symmetric ? palettes.bbr : palettes.bw;
  const highlightPalette = palettes.highlight;

  const histogramView = new HistogramView(
    histogramEl,
    image,
    120,  // TODO infer from image
    palette,
    highlightPalette
  );
  const mainLayer = new HighlightRenderViewLayer(palette, highlightPalette);

  histogramView.on('select', (data) => {
    mainLayer.setHighlight([data.from, data.to]);
    mainLayer.update();
  });

  const navigationView = new NavigationView(
    navigationEl,
    image
  );
  const thumbnailView = new RenderView(
    thumbnailEl,
    image,
    [
      new PaletteRenderViewLayer(palette),
    ]
  );
  const renderView = new RenderView(
    mainEl,
    image,
    [
      mainLayer,
    ]
  );

  window.addEventListener('wheel', (e) => navigationView.setSliceDelta(Math.sign(e.deltaY)), false);
  window.addEventListener('resize', () => renderView.update());

  navigationView.on('axis', ({ axis }) => {
    renderView.update(navigationView.getSlice(), axis);
  });
  navigationView.on('slice', ({ slice }) => {
    renderView.update(slice, navigationView.getAxis());
  });
  navigationView.on('thumbnailSlice', ({ slice }) => {
    thumbnailView.update(slice, navigationView.getAxis());
  });

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

        const res = await fetch(`${ws}${uuid}`);
        const image = await res.arrayBuffer();
        const data = new Int16Array(image);
        prepareRender(ws, uuid, { header, data });
      }
      break;
  }
});
