export const selections = {
  image: null
};

export function renderHistogram(header, image) {
  const histogram = document.getElementById('histogram_bins');
  let count = Array(32767);
  for (const v of image) {
    count[v] = (count[v] || 0) + 1;
  }
  count = [...count.keys()].map((i) => count[i] || 0);
  count = count.slice(1);

  const max = Math.max.apply(null, count);
  count = count.map((c) => c / max);
  let html = ``;
  count.map((v, i) => {
    html += `<div style="width: ${v * 100}%"></div>`
  });
  histogram.innerHTML = html;
}

export function prepareHistogram(header, image, callback) {
  const histogram = document.getElementById('histogram_bins');
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

  renderHistogram(header, image);
}