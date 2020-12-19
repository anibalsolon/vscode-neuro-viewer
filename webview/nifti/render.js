export const rowscols = {
  1: { cols: 2, rows: 3 },
  2: { cols: 1, rows: 3 },
  3: { cols: 1, rows: 2 }
}

export function getRowsCols(header, axis) {
  return {
    rows: header.dims[rowscols[axis].rows],
    cols: header.dims[rowscols[axis].cols],
    axis: header.dims[axis],
  }
}

export function getAxesSteps(header, axis) {
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

export function drawBrainAt(params={}) {
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