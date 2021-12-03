const vscode = acquireVsCodeApi();

import { dynFixed, hexToRgb, rgbToHex, paletteRange } from './utils';
import { rowscols, draw, getRowsCols } from './render';
import { prepareHistogram, selections as histogramSelections } from './histogram';

const documentElement = getComputedStyle(document.documentElement);

const palettes = {
  'bwr': paletteRange({ [-1]: hexToRgb('#0000FFFF'), [0]: hexToRgb('#FFFFFFFF'), [1]: hexToRgb('#FF0000FF') })
}

const colors = {
  scale: palettes['bwr'],
  light: hexToRgb(documentElement.getPropertyValue('--vscode-editor-foreground')),
  dark: hexToRgb(documentElement.getPropertyValue('--vscode-editor-background')),
  highlight: hexToRgb(documentElement.getPropertyValue('--vscode-minimap-findMatchHighlight')),
}

function message(msg) {
  const el = document.getElementById('message');
  if (!msg) {
    el.style.display = 'none';
  } else {
    el.style.display = null;
    el.innerHTML = msg;
  }
}

function updateAxisSelected(axis) {
  const axes = document.getElementById('axes');
  axis = `${axis}`;
  for (const el of axes.children) {
    const elAxis = el.getAttribute('data-axis');
    if (elAxis == axis) {
      el.setAttribute('data-selected', 'true');
    } else {
      el.removeAttribute('data-selected');
    }
  }
}

function updateSlicePosition(slice, slices) {
  document.getElementById('slice').innerHTML = slice + 1;
  const range = document.getElementById('range');
  const el = document.getElementById('position');
  if (range.clientHeigh === 0) {
    return;
  }
  if (el.clientHeigh === 0) {
    return;
  }
  const trueRange = ((range.clientHeight - el.clientHeight) * 100) / range.clientHeight;
  const perc = ((slice / (slices - 1)) * trueRange).toFixed(2);
  el.style.top = `${perc}%`;
}

function renderHeader() {
  const h = window.header;
  const dimdiv = document.getElementById('dimensions');
  dimdiv.innerHTML = `${h.nd}-D: [${h.dimensions.join(', ')}]`;

  const pixelsizes = document.getElementById('pixel_sizes');
  pixelsizes.innerHTML = h.pixel_sizes.map(
    (s, i) =>
      `${s}${i < 3 ? 'mm' : (i == 3 && h.dimensions[3] > 1 ? 's' : '')}`
  ).join(', ');

  const geometry = document.getElementById('geometry');
  geometry.innerHTML = `${h.geometry}`

  const orientation = document.getElementById('orientation');
  orientation.innerHTML = `${h.orientation}`;

  const data_type = document.getElementById('data_type');
  data_type.innerHTML = `${h.data_type}`;
}

function prepareRender(header, image) {
  message('Rendering');

  image = new Int16Array(image);

  const canvasWrapper = document.getElementById('canvas_wrapper');
  const underlay = document.getElementById('canvas_draw');
  const underlayContext = underlay.getContext('2d');

  const histogram = document.getElementById('canvas_histogram');
  const histogramContext = histogram.getContext('2d');

  const axes = document.getElementById('axes');
  const range = document.getElementById('range');
  const position = document.getElementById('position');
  const thumbnail = document.getElementById('thumbnail');
  const canvasThumbnail = document.getElementById('canvas_thumbnail');
  const thumbnailContext = canvasThumbnail.getContext('2d');

  position.style.display = 'block';

  let slices = {}, axis = 1;
  let { cols, rows, axis: size } = getRowsCols(header, axis);

  function updateAxisInfo(updatedAxis) {
    axis = updatedAxis;
    let { cols: updatedCols, rows: updatedRows, axis: updatedSize } = getRowsCols(header, axis);
    cols = updatedCols;
    rows = updatedRows;
    size = updatedSize;
  }

  function drawImage() {
    // underlayContext.clearRect(0, 0, underlay.width, underlay.height);
    draw(
      { header, image },
      underlayContext,
      { axis, slices, colors },
    );
    if (histogramSelections.image) {
      draw(
        { header, image: histogramSelections.image },
        histogramContext,
        { axis, slices, colors }
      );
    }
  }

  function changeAxis(e) {
    const el = e.target;
    let clickedAxis = el.getAttribute('data-axis');
    if (clickedAxis) {
      clickedAxis = parseInt(clickedAxis);
      updateAxisInfo(clickedAxis, true);
      resizeAndRender();
    }
  }

  function scroll(e) {
    slices[axis] += Math.sign(e.deltaY);
    if (slices[axis] < 0) {
      slices[axis] = size + slices[axis];
    } else if (slices[axis] >= size) {
      slices[axis] = size - slices[axis];
    }
    updateSlicePosition(slices[axis], size);
    drawImage();
  }

  function resizeAndRender() {
    if (canvasWrapper.clientWidth === 0) {
      setTimeout(resizeAndRender, 200);
      return;
    }

    if (slices[axis] === undefined) {
      slices[axis] = Math.round(size / 2);
    }

    updateSlicePosition(slices[axis], size);
    updateAxisSelected(axis);

    const [width, height] = [canvasWrapper.clientWidth, canvasWrapper.clientHeight];

    const voxels = header.pixelSizes;
    const imageWidth =  cols * (voxels[rowscols[axis].cols] / voxels[rowscols[axis].rows]);
    const imageHeight = rows * (voxels[rowscols[axis].rows] / voxels[rowscols[axis].cols]);

    histogram.width = underlay.width = cols;
    histogram.height = underlay.height = rows;
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

    canvasWrapper.style.backgroundColor = rgbToHex(colors.scale[0]);
    histogram.style.width = underlay.style.width = `${css.width}px`;
    histogram.style.height = underlay.style.height = `${css.height}px`;
    histogram.style.top = underlay.style.top = `${css.top}px`;
    histogram.style.left = underlay.style.left = `${css.left}px`;

    drawImage();
  }

  const axesNames = [null, 'X', 'Y', 'Z'];
  header.dimensions.map((d, o) => {
    if (o == 0 || o > 3 || d <= 1) {
      return;
    }
    var el = document.createElement('div');
    el.innerHTML = axesNames[o];
    el.setAttribute('data-axis', o);
    el.addEventListener('click', changeAxis, false);
    axes.appendChild(el);
  })

  window.addEventListener('wheel', scroll, false);
  window.addEventListener('resize', resizeAndRender);

  let rangeRect, thumbRectOrig, thumbRect, thumbSlice, thumbStepX, thumbStepY;
  thumbRectOrig = thumbnail.getBoundingClientRect();

  function fetchRatioAndSliceFromRange(e) {
    const y = e.clientY - rangeRect.top;
    const ratio = y / rangeRect.height;
    const slice = Math.min(size, Math.max(1, Math.round(size * ratio))) - 1;
    return { slice, ratio };
  }

  function renderFromRange(e) {
    e.preventDefault();

    const { slice, ratio } = fetchRatioAndSliceFromRange(e);
    thumbnail.style.top = `${(ratio - (thumbRect.height / rangeRect.height * ratio)) * 100}%`;
    thumbSlice = slice;

    draw(
      { header, image },
      thumbnailContext,
      {
        axis,
        slices: { [axis]: thumbSlice },
        stepX: thumbStepX,
        stepY: thumbStepY,
        colors,
      }
    );
  }

  range.addEventListener('mouseover', function(e) {
    rangeRect = range.getBoundingClientRect();

    thumbnail.style.display = 'block';
    const y = e.clientY - rangeRect.top;
    thumbnail.style.top = `${y / range.clientHeight * 100}%`;

    if (thumbRectOrig.width == 0 || thumbRectOrig.height == 0) {
      thumbRectOrig = canvasThumbnail.getBoundingClientRect();
    }
    thumbRect = { width: thumbRectOrig.width, height: thumbRectOrig.height };

    const voxels = header.pixelSizes;
    const imageWidth = cols * (voxels[rowscols[axis].cols] / voxels[rowscols[axis].rows]);
    const imageHeight = rows * (voxels[rowscols[axis].rows] / voxels[rowscols[axis].cols]);

    let [resizedWidth, resizedHeight] = [thumbRect.width, rows * thumbRect.width / imageWidth];
    if (resizedHeight > thumbRect.height) {
      resizedHeight = thumbRect.height;
      resizedWidth = cols * thumbRect.height / imageHeight;
    }

    const css = {
      width: Math.floor(resizedWidth),
      height: Math.floor(resizedHeight),
    };

    thumbStepX = Math.max(1, Math.floor(cols / css.width));
    thumbStepY = Math.max(1, Math.floor(rows / css.height));

    thumbnail.style.width = `${css.width}px`;
    thumbnail.style.height = `${css.height}px`;
    canvasThumbnail.style.width = `${css.width}px`;
    canvasThumbnail.style.height = `${css.height}px`;
    canvasThumbnail.width = Math.floor(cols / thumbStepX);
    canvasThumbnail.height = Math.floor(rows / thumbStepY);

    renderFromRange(e);
  });
  range.addEventListener('mousemove', renderFromRange);
  range.addEventListener('mouseout', function(e) {
    e.preventDefault();
    thumbnail.style.display = 'none';
  });
  range.addEventListener('click', function(e) {
    e.preventDefault();
    const { slice } = fetchRatioAndSliceFromRange(e);
    slices[axis] = slice;
    updateSlicePosition(slices[axis], size);
    drawImage();

    renderFromRange(e);
  });

  resizeAndRender();
  prepareHistogram(
    { header, image }, 101, { colors },
    function() {
      if (histogramSelections.image) {
        draw(
          { header, image: histogramSelections.image },
          histogramContext,
          { axis, slices, colors }
        );
      }
    }
  );

  message();
}

window.ws = null;
window.header = null;

window.addEventListener('message', async e => {
  const { type, body, requestId } = e.data;
  switch (type) {
    case 'init':
      {
        window.ws = body.ws;
        const uuid = body.uuid;
        const header = body.header;

        const geo = header.affine.map((l) => l.map((v) => dynFixed(-1 * v, 3)).join(',')).join(',');
        const ndims = header.dimensions[0];
        const dims = header.dimensions.slice(1, 1 + ndims);
        const pixelSizes = header.pixelSizes.slice(1, 1 + ndims);

        const orientation = dims < 3 ? '' : (
          `${header.qOffset.x > 0 ? 'R' : 'L'}` +
          `${header.qOffset.y > 0 ? 'A' : 'P'}` +
          `${header.qOffset.z > 0 ? 'S' : 'I'}`
        )

        window.header = {
          geometry: `MATRIX(${geo}):${dims.slice(0, 3).join(',')}`,
          nd: ndims,
          dimensions: dims,
          pixel_sizes: pixelSizes,
          data_type: header.dataType,
          orientation,
        };

        renderHeader();

        message('Loading');

        fetch(`${window.ws}${uuid}`)
          .then((res) => res.arrayBuffer())
          .then((image) => prepareRender(header, image))
      }
      break;
  }
});

vscode.postMessage({ type: 'ready' });