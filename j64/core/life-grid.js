class LifeGrid {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.cells = new Uint8Array(width * height);
  }

  get(x, y) {
    if (x < 0) x = this.width - 1;
    if (x >= this.width) x = 0;
    if (y < 0) y = this.height - 1;
    if (y >= this.height) y = 0;
    return this.cells[y * this.width + x];
  }

  set(x, y, value) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.cells[y * this.width + x] = value ? 1 : 0;
    }
  }

  countNeighbors(x, y) {
    const w = this.width;
    const h = this.height;
    const xm1 = (x - 1 + w) % w;
    const xp1 = (x + 1) % w;
    const ym1 = (y - 1 + h) % h;
    const yp1 = (y + 1) % h;

    const rowAbove = ym1 * w;
    const rowSame = y * w;
    const rowBelow = yp1 * w;

    return (
      this.cells[rowAbove + xm1] +
      this.cells[rowAbove + x] +
      this.cells[rowAbove + xp1] +
      this.cells[rowSame + xm1] +
      this.cells[rowSame + xp1] +
      this.cells[rowBelow + xm1] +
      this.cells[rowBelow + x] +
      this.cells[rowBelow + xp1]
    );
  }

  fillRandom(density = 0.3) {
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i] = Math.random() < density ? 1 : 0;
    }
  }

  clear() {
    this.cells.fill(0);
  }

  copyFrom(other) {
    if (other.width === this.width && other.height === this.height) {
      this.cells.set(other.cells);
    }
  }

  clone() {
    const grid = new LifeGrid(this.width, this.height);
    grid.cells.set(this.cells);
    return grid;
  }

  toArray() {
    return Array.from(this.cells);
  }

  fromArray(arr) {
    if (arr.length === this.cells.length) {
      this.cells.set(arr);
    }
  }
}

module.exports = LifeGrid;
