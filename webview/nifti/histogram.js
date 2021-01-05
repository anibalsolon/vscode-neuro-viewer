export const selections = {
  image: null
};

export function renderHistogram(header, image) {
  const histogram = document.getElementById('histogram_bins');
  let count = [...Array(256).keys()].map(i => image.filter(v => v === i).length).slice(1);
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
    updateRange(from, to);
    return [from, to];
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
    
    if (!clicked) {
      return;
    }
    clicked = false;

    let [start, end] = move(e);
    start = Math.round(start * 255);
    end = Math.round(end * 255);

    if (start === end) {
      end = start + 1;
    }
    updateRange(start / 255, end / 255);

    if (selections.image === null) {
      selections.image = Uint8Array.from(image);
    }

    const rangeStart = 100, rangeEnd = 255;
    const rangeDiff = rangeEnd - rangeStart;
    const selectionDiff = end - start;

    for (let i = 0; i < selections.image.length; i++) {
      if (image[i] < start || image[i] > end) {
        selections.image[i] = 0;
        continue
      }

      selections.image[i] = rangeDiff * (image[i] - start) / selectionDiff + rangeStart;
    }

    callback();
  });

  renderHistogram(header, image);
}