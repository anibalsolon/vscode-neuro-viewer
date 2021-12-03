import { DATA_TYPE_RANGE } from './constants';
import { scale, lerp, rgbToHex } from './utils';

export const selections = {
  image: null
};

export function renderHistogram({ header, image }, bins, { colors }) {
  const histogram = document.getElementById('histogram_bins');
  const valueToBin = {};
  const valueToBinColor = {};
  let bin, prevBin = 0, prevBinValue = -DATA_TYPE_RANGE;
  for (let i = -DATA_TYPE_RANGE; i <= DATA_TYPE_RANGE; i++) {
    bin = scale(i, [-DATA_TYPE_RANGE, DATA_TYPE_RANGE], [0, bins - 1]);
    valueToBin[i] = bin;
    if (bin !== prevBin) {
      valueToBinColor[prevBin] = lerp(
        colors.scale[prevBinValue],
        colors.scale[i],
        i / DATA_TYPE_RANGE
      );
      prevBin = bin;
      prevBinValue = i;
    }
  }
  valueToBinColor[bin] = lerp(
    colors.scale[prevBinValue],
    colors.scale[DATA_TYPE_RANGE],
    1.0
  );

  let count = Array(bins).fill(0);
  for (const v of image) {
    count[valueToBin[v]] = (count[valueToBin[v]] || 0) + 1;
  }
  count = [...count.keys()].map((i) => count[i] || 0);
  const zeroed = count[valueToBin[0]] || 0;
  count[valueToBin[0]] = 0;

  const max = Math.max.apply(null, count);
  count = count.map((c) => c / max);
  count[valueToBin[0]] = Math.min(zeroed / max, 1);
  
  let html = '';
  count.forEach((v, i) => {
    html += `<div data-bin="${bins-i-1}" style="width: ${v * 100}%; background: ${rgbToHex(valueToBinColor[bins-i-1])}"></div>`
  });
  histogram.innerHTML = html;
  histogram.style.backgroundColor = rgbToHex(colors.scale[0]);
}

export function prepareHistogram({ header, image }, bins, { colors }, callback) {
  const histogram_selections = document.getElementById('histogram_selections');

  function updateRange(from, to) {
    histogram_selections.innerHTML = `
      <div style="top: ${from * 100}%; height: ${Math.abs(to - from) * 100}%"></div>
    `;
  }

  let start, end, rect, clicked = false;
  function move(e) {
    const y = e.clientY - rect.top;
    end = y / rect.height;

    const from = Math.max(0, end > start ? start : end);
    const to = Math.min(1, end < start ? start : end);

    let startBin = Math.round(from * 255);
    let endBin = Math.round(to * 255);
    endBin = startBin + 1;
    render(startBin, endBin - 1);

    if (start < end) {
      [startBin, endBin] = [startBin / 255, endBin / 255];
      updateRange(startBin, endBin);
    } else {
      [startBin, endBin] = [endBin / 255, startBin / 255];
      updateRange(startBin, endBin);
    }

    callback();
  }

  function render(start, end) {
    if (selections.image === null) {
      selections.image = Int16Array.from(image);
    }
    selections.image = selections.image.fill(0);

    const rangeStart = 100, rangeEnd = 255;
    const rangeDiff = rangeEnd - rangeStart;
    const selectionDiff = end - start;

    for (let i = 0; i < selections.image.length; i++) {
      if (image[i] < start || image[i] > end) {
        continue
      }

      if (selectionDiff === 0) {
        selections.image[i] = 255;
        continue
      }

      selections.image[i] = rangeDiff * (image[i] - start) / selectionDiff + rangeStart;
    }
  }

  histogram_selections.addEventListener('mousedown', function(e) {
    rect = histogram_selections.getBoundingClientRect();
    const y = e.clientY - rect.top;
    start = y / rect.height;
    document.addEventListener('mousemove', move);
    clicked = true;
  });
  document.addEventListener('mouseup', function(e) {
    document.removeEventListener('mousemove', move);
    if (!clicked)
      return;
    clicked = false;
    move(e);
  });

  renderHistogram({ header, image }, bins, { colors });
}