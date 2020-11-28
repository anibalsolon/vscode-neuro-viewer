import { NIFTI1 } from 'nifti-reader-js';

const vscode = acquireVsCodeApi();

const data_types = {
   0: 'unknown',
   1: 'binary (1 bit/voxel)',
   2: 'unsigned char (8 bits/voxel',
   4: 'signed short (16 bits/voxel',
   8: 'signed int (32 bits/voxel)',
  16: 'float (32 bits/voxel)',
  32: 'complex (64 bits/voxel)',
  64: 'double (64 bits/voxel)',
 128: 'RGB triple (24 bits/voxel)',
 255: 'not very useful (?)',
 256: 'signed char (8 bits)',
 512: 'unsigned short (16 bits)',
 768: 'unsigned int (32 bits)',
1024: 'long long (64 bits)',
1280: 'unsigned long long (64 bits',
1536: 'long double (128 bits)',
1792: 'double pair (128 bits)',
2048: 'long double pair (256 bits)',
2304: '4 byte RGBA (32 bits/voxel)',
}

function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

const colors = {
  light: getComputedStyle(document.documentElement).getPropertyValue('--vscode-editor-foreground'),
  dark: getComputedStyle(document.documentElement).getPropertyValue('--vscode-editor-background'),
}

function dynFixed(number, decimals) {
  return number.toFixed(decimals).replace(/^[\.0]+|[\.0]+$/g, '') || '0';
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
  const { cols, rows, axis: axes } = getRowsCols(header, 1)
  switch (axis) {
    case 1:
      return {
        rows_step: -cols * axes,
        cols_step: axes,
        axis_step: 1,
      }
    case 2:
      return {
        rows_step: axes,
        cols_step: 1,
        axis_step: cols * axes,
      }
    case 3:
      return {
        rows_step: -cols * axes,
        cols_step: 1,
        axis_step: axes,
      }
  }
}

function draw(images, canvas, { axis, slice, color='#FFFFFF' }) {
  const { cols, rows } = getRowsCols(images.underlay.header, axis)
  const { underlay } = images
  slice = slice[axis]

  const underlayOptions = {
    nifti: underlay,
    axis,
    slice,
    color: hexToRgb(color),
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

  const {
    imageData, 
    nifti,
    axis,
    slice, 
    color,
  } = params

  let { cols_step, rows_step, axis_step } = getAxesSteps(nifti.header, axis)
  let { cols, rows } = getRowsCols(nifti.header, axis)

  let row, col;
  let tz_offset, tzy_offset, tzyx_offset, image_offset;

  var x_positive = cols_step > 0
  var y_positive = rows_step > 0
  cols_step = Math.abs(cols_step)
  rows_step = Math.abs(rows_step)

  tz_offset = slice * axis_step
  for (row = rows - 1; row >= 0; row--) {
    tzy_offset = tz_offset + (y_positive ? row : rows - row - 1) * rows_step
    for (col = 0; col < cols; col++) {
      tzyx_offset = tzy_offset + (x_positive ? col : cols - col - 1) * cols_step;
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

function render() {
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

window.header = null;

window.addEventListener('message', async e => {
  const { type, body, requestId } = e.data;
  console.log(e);
  switch (type) {
    case 'init':
      {
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

        render();

        document.getElementById('dimensions').addEventListener('click', function() {
          vscode.postMessage({ type: 'data' });
        })
      }
      break;

    case 'data':
      {
        let { header, image, extension } = body;
        if (header.datatypeCode === NIFTI1.TYPE_UINT8) {
          image = Uint8Array.from(image);
        } else if (header.datatypeCode === NIFTI1.TYPE_INT16) {
          image = Int16Array.from(image);
        } else if (header.datatypeCode === NIFTI1.TYPE_INT32) {
          image = Int32Array.from(image);
        } else if (header.datatypeCode === NIFTI1.TYPE_FLOAT32) {
          image = Float32Array.from(image);
        } else if (header.datatypeCode === NIFTI1.TYPE_FLOAT64) {
          image = Float64Array.from(image);
        } else if (header.datatypeCode === NIFTI1.TYPE_INT8) {
          image = Int8Array.from(image);
        } else if (header.datatypeCode === NIFTI1.TYPE_UINT16) {
          image = Uint16Array.from(image);
        } else if (header.datatypeCode === NIFTI1.TYPE_UINT32) {
          image = Uint32Array.from(image);
        }

        function resizeAndRender() {
          const underlay_wrapper = document.getElementById('canvas');
          const underlay = document.getElementById('canvas_draw');
          const underlayContext = underlay.getContext('2d');
          const axis = 1;
          const slice = 20;
  
          const { cols, rows } = getRowsCols(header, axis)
          const [width, height] = [underlay_wrapper.clientWidth, underlay_wrapper.clientHeight]
          const imageWidth = cols
          const imageHeight = rows
  
          underlay.width = cols;
          underlay.height = rows;
          let [resizedWidth, resizedHeight] = [width, rows * width / imageWidth]
          if (resizedHeight > height) {
            resizedHeight = height
            resizedWidth = cols * height / imageHeight
          }
  
          const css = {
            width: Math.round(resizedWidth),
            height: Math.round(resizedHeight),
            top: Math.round(height / 2 -  resizedHeight / 2),
            left: Math.round(width / 2 -  resizedWidth / 2),
          }
  
          underlay.style.width = `${css.width}px`;
          underlay.style.height = `${css.height}px`;
          underlay.style.top = `${css.top}px`;
          underlay.style.left = `${css.left}px`;
  
          draw({
            underlay: { header, image },
          }, {
            underlay: underlayContext
          }, { axis, slice: { [axis]: slice }, color: colors.light });
        }

        window.addEventListener('resize', resizeAndRender);
        resizeAndRender();
      }
      break;
  }
});

vscode.postMessage({ type: 'ready' });