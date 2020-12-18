const vscode = acquireVsCodeApi();

const data_types = {
   0: 'unknown',
   1: 'binary (1 bit)',
   2: 'unsigned char (8 bits)',
   4: 'signed short (16 bits)',
   8: 'signed int (32 bits)',
  16: 'float (32 bits)',
  32: 'complex (64 bits)',
  64: 'double (64 bits)',
 128: 'RGB triple (24 bits)',
 255: 'unknown',
 256: 'signed char (8 bits)',
 512: 'unsigned short (16 bits)',
 768: 'unsigned int (32 bits)',
1024: 'long long (64 bits)',
1280: 'unsigned long long (64 bits)',
1536: 'long double (128 bits)',
1792: 'double pair (128 bits)',
2048: 'long double pair (256 bits)',
2304: '4 byte RGBA (32 bits)',
}

function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function dynFixed(number, decimals) {
  return number.toFixed(decimals).replace(/^[\.0]+|[\.0]+$/g, '') || '0';
}

function message(msg) {
  const el = document.getElementById('message');
  if (!msg) {
    el.style.display = 'none';
  } else {
    el.style.display = 'block';
    el.innerHTML = msg;
  }
}

const documentElement = getComputedStyle(document.documentElement);
const colors = {
  light: hexToRgb(documentElement.getPropertyValue('--vscode-editor-foreground')),
  dark: hexToRgb(documentElement.getPropertyValue('--vscode-editor-background')),
}

const rowscols = {
  1: { cols: 2, rows: 3 },
  2: { cols: 1, rows: 3 },
  3: { cols: 1, rows: 2 }
}

function getRowsCols(header, axis) {
  return {
    rows: header.dims[rowscols[axis].rows],
    cols: header.dims[rowscols[axis].cols],
    axis: header.dims[axis],
  }
}

function getAxesSteps(header, axis) {
  const { cols, rows, axis: axes } = getRowsCols(header, 1);

  const direction = {
    1: header.qoffset_x > 0 ? 1 : -1,
    2: header.qoffset_y > 0 ? 1 : -1,
    3: header.qoffset_z > 0 ? 1 : -1,
  }

  const steps = {
    1: 1,
    2: axes,
    3: cols * axes,
  }

  const rowscolsaxis = rowscols[axis];
  return {
    rows_step: steps[rowscolsaxis.rows] * direction[rowscolsaxis.rows],
    cols_step: steps[rowscolsaxis.cols] * direction[rowscolsaxis.cols],
    axis_step: steps[axis],
  };
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
  const el = document.getElementById('position');
  const perc = ((slice / slices) * 100).toFixed(2);
  el.style.top = `${perc}%`;
}

function draw(images, canvas, { axis, slices, color, stepX, stepY }) {
  const { cols, rows } = getRowsCols(images.underlay.header, axis)
  const { underlay } = images

  const slice = slices[axis]
  
  const underlayOptions = {
    nifti: underlay,
    axis,
    slice,
    color,
    stepX,
    stepY,
  }
  const underlayData = drawBrainAt({
    imageData: canvas.underlay.createImageData(cols, rows),
    ...underlayOptions,
  })
  canvas.underlay.putImageData(
    underlayData,
    0, 0
  )
}

function drawBrainAt(params={}) {
  params = {
    axis: 1,
    ...params,
  }

  const { imageData, nifti, axis, slice, color, stepX = 1, stepY = 1 } = params
  let { cols_step, rows_step, axis_step } = getAxesSteps(nifti.header, axis);
  let { cols, rows } = getRowsCols(nifti.header, axis);

  let row, col;
  let tz_offset, tzy_offset, tzyx_offset, image_offset;

  let x_positive = cols_step > 0;
  let y_positive = rows_step > 0;
  cols_step = Math.abs(cols_step);
  rows_step = Math.abs(rows_step);

  tz_offset = slice * axis_step
  for (row = 0; row < rows; row += 1) {
    tzy_offset = tz_offset + (y_positive ? row * stepY : rows - row * stepY - 1) * rows_step;
    for (col = 0; col < cols; col += 1) {
      tzyx_offset = tzy_offset + (x_positive ? col * stepX : cols - col * stepX - 1) * cols_step;
      image_offset = (row * (cols * 4) + col * 4);

      let value = nifti.image[tzyx_offset];
      imageData.data[image_offset + 0] = color.r;
      imageData.data[image_offset + 1] = color.g;
      imageData.data[image_offset + 2] = color.b;
      imageData.data[image_offset + 3] = value;
    }
  }
  return imageData
}

function renderHeader() {
  const h = window.header;
  const dimdiv = document.getElementById('dimensions');
  dimdiv.innerHTML = `${h.nd}-D: [${h.dimensions.join(', ')}]`

  const pixelsizes = document.getElementById('pixel_sizes');
  pixelsizes.innerHTML = `${h.pixel_sizes.map((s, i) => `${s}${i < 3 ? 'mm' : (i == 3 && h.dimensions[3] > 1 ? 's' : '')}`).join(', ')}`

  const geometry = document.getElementById('geometry');
  geometry.innerHTML = `${h.geometry}`

  const orientation = document.getElementById('orientation');
  orientation.innerHTML = `${h.orientation}`

  const data_type = document.getElementById('data_type');
  data_type.innerHTML = `${h.data_type}`
}

function prepareRender(header, image) {
  message('Rendering');

  image = new Uint8Array(image);

  const underlayWrapper = document.getElementById('canvas');
  const underlay = document.getElementById('canvas_draw');
  const underlayContext = underlay.getContext('2d');
  const axes = document.getElementById('axes');
  const range = document.getElementById('range');
  const thumbnail = document.getElementById('thumbnail');
  const canvasThumbnail = document.getElementById('canvas_thumbnail');
  const thumbnailContext = canvasThumbnail.getContext('2d');

  document.getElementById('position').style.display = 'block';

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
    draw({
      underlay: { header, image },
    }, {
      underlay: underlayContext
    }, { axis, slices, color: colors.light });
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
    if (slices[axis] === undefined) {
      slices[axis] = Math.round(size / 2);
    }

    updateSlicePosition(slices[axis], size);
    updateAxisSelected(axis);

    const [width, height] = [underlayWrapper.clientWidth, underlayWrapper.clientHeight];
    const voxels = header.pixDims;
    const imageWidth =  cols * (voxels[rowscols[axis].cols] / voxels[rowscols[axis].rows]);
    const imageHeight = rows * (voxels[rowscols[axis].rows] / voxels[rowscols[axis].cols]);

    underlay.width = cols;
    underlay.height = rows;
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

    underlay.style.width = `${css.width}px`;
    underlay.style.height = `${css.height}px`;
    underlay.style.top = `${css.top}px`;
    underlay.style.left = `${css.left}px`;

    drawImage();
  }

  const axesNames = [null, 'X', 'Y', 'Z'];
  header.dims.map((d, o) => {
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

  const color = hexToRgb('#FFFFFF');
  const rangeRect = range.getBoundingClientRect();
  let thumbRect, thumbStepX, thumbStepY;

  range.addEventListener('mouseover', function(e) {
    thumbnail.style.display = 'block';
    const y = e.clientY - rangeRect.top;
    thumbnail.style.top = `${y / range.clientHeight * 100}%`;

    thumbRect = canvasThumbnail.getBoundingClientRect();
    thumbRect = { width: thumbRect.width, height: thumbRect.height };

    const voxels = header.pixDims;
    const imageWidth =  cols * (voxels[rowscols[axis].cols] / voxels[rowscols[axis].rows]);
    const imageHeight = rows * (voxels[rowscols[axis].rows] / voxels[rowscols[axis].cols]);

    let ratio = imageWidth / imageHeight;
    thumbRect.width = thumbRect.height * ratio;
    thumbStepX = Math.max(1, Math.floor(cols / thumbRect.width));
    thumbStepY = Math.max(1, Math.floor(rows / thumbRect.height));
    const realWidth = Math.round(cols / thumbStepX);
    const realHeight = Math.round(rows / thumbStepY);

    canvasThumbnail.width = realWidth;
    canvasThumbnail.height = realHeight;
    canvasThumbnail.style.width = `${thumbRect.width}px`;
    canvasThumbnail.style.height = `${thumbRect.height}px`;
    thumbnail.style.width = `${thumbRect.width}px`;
    thumbnail.style.height = `${thumbRect.height}px`;
  });
  range.addEventListener('mousemove', function(e) {
    // TODO center slider into position
    const y = e.clientY - rangeRect.top;
    const ratio = y / rangeRect.height;
    thumbnail.style.top = `${(ratio - (thumbRect.height / rangeRect.height * ratio)) * 100}%`;
    const thumbSlice = Math.min(size, Math.max(0, Math.round(size * ratio)));

    draw({
      underlay: { header, image },
    }, {
      underlay: thumbnailContext
    }, {
      axis,
      slices: { [axis]: thumbSlice },
      stepX: thumbStepX,
      stepY: thumbStepY,
      color,
    });
  });
  range.addEventListener('mouseout', function() {
    thumbnail.style.display = 'none';
  });
  range.addEventListener('click', function(e) {
    e.preventDefault();
    thumbnail.style.display = 'none';
    const y = e.clientY - rangeRect.top;
    let ratio = y / rangeRect.height;
    if (ratio > 1.0) {
      ratio = 1.0;
    } else if (ratio < 0.0) {
      ratio = 1.0;
    }
    slices[axis] = Math.round(size * ratio);
    updateSlicePosition(slices[axis], size);
    drawImage();
  });

  resizeAndRender();
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
        const ndims = header.dims[0];
        const dims = header.dims.slice(1, 1 + ndims);
        const pixdims = header.pixDims.slice(1, 1 + ndims);

        const orientation = dims < 3 ? '' : (
          `${header.qoffset_x > 0 ? 'R' : 'L'}` +
          `${header.qoffset_y > 0 ? 'A' : 'P'}` +
          `${header.qoffset_z > 0 ? 'S' : 'I'}`
        )

        window.header = {
          geometry: `MATRIX(${geo}):${dims.slice(0, 3).join(',')}`,
          nd: ndims,
          dimensions: dims,
          pixel_sizes: pixdims,
          data_type: data_types[header.datatypeCode],
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