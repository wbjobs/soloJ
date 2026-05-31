const { parentPort, workerData } = require('worker_threads');

const { width, height, startY, endY } = workerData;
const rowCount = endY - startY;
const totalCells = rowCount * width;

let currentBuf = new Uint8Array(totalCells);
let nextBuf = new Uint8Array(totalCells);

function evolveRegion(topRow, bottomRow) {
  const w = width;
  const h = height;
  const current = currentBuf;
  const next = nextBuf;

  for (let y = startY; y < endY; y++) {
    const localY = y - startY;
    const rowOffset = localY * w;

    const ym1 = y - 1;
    const yp1 = y + 1;

    const ym1Local = ym1 - startY;
    const yp1Local = yp1 - startY;
    const useTopRow = (ym1 < 0);
    const useBottomRow = (yp1 >= h);
    const ym1InBounds = (!useTopRow && ym1Local >= 0 && ym1Local < rowCount);
    const yp1InBounds = (!useBottomRow && yp1Local >= 0 && yp1Local < rowCount);

    for (let x = 0; x < w; x++) {
      const xm1 = (x - 1 + w) % w;
      const xp1 = (x + 1) % w;

      let n = 0;

      if (useTopRow) {
        n += topRow[xm1] + topRow[x] + topRow[xp1];
      } else if (ym1InBounds) {
        const idx = ym1Local * w;
        n += current[idx + xm1] + current[idx + x] + current[idx + xp1];
      } else {
        n += topRow[xm1] + topRow[x] + topRow[xp1];
      }

      n += current[rowOffset + xm1] + current[rowOffset + xp1];

      if (useBottomRow) {
        n += bottomRow[xm1] + bottomRow[x] + bottomRow[xp1];
      } else if (yp1InBounds) {
        const idx2 = yp1Local * w;
        n += current[idx2 + xm1] + current[idx2 + x] + current[idx2 + xp1];
      } else {
        n += bottomRow[xm1] + bottomRow[x] + bottomRow[xp1];
      }

      const cell = current[rowOffset + x];
      next[rowOffset + x] = (cell === 1 && (n === 2 || n === 3)) ||
                            (cell === 0 && n === 3) ? 1 : 0;
    }
  }

  const temp = currentBuf;
  currentBuf = nextBuf;
  nextBuf = temp;

  const resultTop = new Uint8Array(w);
  const resultBottom = new Uint8Array(w);
  resultTop.set(currentBuf.subarray(0, w));
  resultBottom.set(currentBuf.subarray((rowCount - 1) * w, rowCount * w));

  const dataCopy = new Uint8Array(currentBuf);

  return {
    data: dataCopy,
    topRow: resultTop,
    bottomRow: resultBottom
  };
}

parentPort.on('message', (msg) => {
  switch (msg.type) {
    case 'setData':
      currentBuf.set(msg.data);
      break;
    case 'evolve':
      const result = evolveRegion(msg.topRow, msg.bottomRow);
      parentPort.postMessage({
        type: 'result',
        startY,
        endY,
        data: result.data,
        topRow: result.topRow,
        bottomRow: result.bottomRow
      });
      break;
    case 'setCell':
      const { x, y, value } = msg;
      const localY = y - startY;
      if (localY >= 0 && localY < rowCount) {
        currentBuf[localY * width + x] = value ? 1 : 0;
      }
      break;
  }
});
