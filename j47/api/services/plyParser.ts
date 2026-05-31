export interface ParseResult {
  pointCount: number;
  positions: number[];
  colors: number[] | null;
  normals: number[] | null;
  boundingBox: { min: [number, number, number]; max: [number, number, number] };
}

interface PropertyDef {
  name: string;
  type: string;
  size: number;
}

interface ElementDef {
  name: string;
  count: number;
  properties: PropertyDef[];
}

function plyTypeSize(type: string): number {
  switch (type) {
    case 'char': case 'int8': case 'uchar': case 'uint8': return 1;
    case 'short': case 'int16': case 'ushort': case 'uint16': return 2;
    case 'int': case 'int32': case 'uint': case 'uint32': case 'float': case 'float32': return 4;
    case 'double': case 'float64': return 8;
    default: return 4;
  }
}

function readBinaryValue(view: DataView, offset: number, type: string): number {
  switch (type) {
    case 'char': case 'int8': return view.getInt8(offset);
    case 'uchar': case 'uint8': return view.getUint8(offset);
    case 'short': case 'int16': return view.getInt16(offset, true);
    case 'ushort': case 'uint16': return view.getUint16(offset, true);
    case 'int': case 'int32': return view.getInt32(offset, true);
    case 'uint': case 'uint32': return view.getUint32(offset, true);
    case 'float': case 'float32': return view.getFloat32(offset, true);
    case 'double': case 'float64': return view.getFloat64(offset, true);
    default: return view.getFloat32(offset, true);
  }
}

function isUcharType(type: string): boolean {
  return type === 'uchar' || type === 'uint8';
}

export function parsePLY(buffer: Buffer): ParseResult {
  const endHeaderLF = buffer.indexOf('end_header\n');
  const endHeaderCRLF = buffer.indexOf('end_header\r\n');

  let headerEnd: number;
  let dataOffset: number;

  if (endHeaderCRLF !== -1 && (endHeaderLF === -1 || endHeaderCRLF < endHeaderLF)) {
    headerEnd = endHeaderCRLF;
    dataOffset = endHeaderCRLF + 'end_header\r\n'.length;
  } else if (endHeaderLF !== -1) {
    headerEnd = endHeaderLF;
    dataOffset = endHeaderLF + 'end_header\n'.length;
  } else {
    throw new Error('Invalid PLY file: no end_header found');
  }

  const headerStr = buffer.slice(0, headerEnd).toString('ascii');
  const lines = headerStr.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  if (lines[0] !== 'ply') {
    throw new Error('Invalid PLY file: does not start with "ply"');
  }

  let format = 'ascii';
  let vertexElement: ElementDef = { name: 'vertex', count: 0, properties: [] };
  let currentElement: ElementDef | null = null;

  for (const line of lines) {
    if (line.startsWith('format ')) {
      format = line.split(/\s+/)[1];
    } else if (line.startsWith('element ')) {
      const parts = line.split(/\s+/);
      currentElement = { name: parts[1], count: parseInt(parts[2], 10), properties: [] };
      if (currentElement.name === 'vertex') {
        vertexElement = currentElement;
      }
    } else if (line.startsWith('property ') && currentElement) {
      const parts = line.split(/\s+/);
      if (parts[1] !== 'list') {
        currentElement.properties.push({
          type: parts[1],
          name: parts[2],
          size: plyTypeSize(parts[1]),
        });
      }
    }
  }

  const vertexCount = vertexElement.count;
  const props = vertexElement.properties;

  const propIndex = new Map<string, number>();
  props.forEach((p, i) => propIndex.set(p.name, i));

  const hasX = propIndex.has('x');
  const hasY = propIndex.has('y');
  const hasZ = propIndex.has('z');
  const hasRed = propIndex.has('red');
  const hasGreen = propIndex.has('green');
  const hasBlue = propIndex.has('blue');
  const hasNx = propIndex.has('nx');
  const hasNy = propIndex.has('ny');
  const hasNz = propIndex.has('nz');

  const hasColor = hasRed && hasGreen && hasBlue;
  const hasNormal = hasNx && hasNy && hasNz;
  const colorIsUchar = hasColor && isUcharType(props[propIndex.get('red')!].type);

  const positions: number[] = [];
  const colors: number[] = [];
  const normals: number[] = [];

  if (format === 'ascii') {
    const dataStr = buffer.slice(dataOffset).toString('utf-8');
    const dataLines = dataStr.split(/\r?\n/);

    for (let i = 0; i < vertexCount && i < dataLines.length; i++) {
      const trimmed = dataLines[i].trim();
      if (trimmed.length === 0) { vertexCount > dataLines.length || i++; continue; }
      const values = trimmed.split(/\s+/).map(Number);

      if (hasX) positions.push(values[propIndex.get('x')!]);
      if (hasY) positions.push(values[propIndex.get('y')!]);
      if (hasZ) positions.push(values[propIndex.get('z')!]);

      if (hasColor) {
        const rv = values[propIndex.get('red')!];
        const gv = values[propIndex.get('green')!];
        const bv = values[propIndex.get('blue')!];
        if (colorIsUchar) {
          colors.push(rv / 255, gv / 255, bv / 255);
        } else {
          colors.push(rv, gv, bv);
        }
      }

      if (hasNormal) {
        normals.push(values[propIndex.get('nx')!], values[propIndex.get('ny')!], values[propIndex.get('nz')!]);
      }
    }
  } else if (format === 'binary_little_endian') {
    const rowSize = props.reduce((sum, p) => sum + p.size, 0);
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    for (let i = 0; i < vertexCount; i++) {
      const rowStart = dataOffset + i * rowSize;
      let propOffset = rowStart;

      const values: number[] = [];
      for (const prop of props) {
        values.push(readBinaryValue(view, propOffset, prop.type));
        propOffset += prop.size;
      }

      if (hasX) positions.push(values[propIndex.get('x')!]);
      if (hasY) positions.push(values[propIndex.get('y')!]);
      if (hasZ) positions.push(values[propIndex.get('z')!]);

      if (hasColor) {
        const rv = values[propIndex.get('red')!];
        const gv = values[propIndex.get('green')!];
        const bv = values[propIndex.get('blue')!];
        if (colorIsUchar) {
          colors.push(rv / 255, gv / 255, bv / 255);
        } else {
          colors.push(rv, gv, bv);
        }
      }

      if (hasNormal) {
        normals.push(values[propIndex.get('nx')!], values[propIndex.get('ny')!], values[propIndex.get('nz')!]);
      }
    }
  } else {
    throw new Error(`Unsupported PLY format: ${format}`);
  }

  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

  for (let i = 0; i < positions.length; i += 3) {
    min[0] = Math.min(min[0], positions[i]);
    min[1] = Math.min(min[1], positions[i + 1]);
    min[2] = Math.min(min[2], positions[i + 2]);
    max[0] = Math.max(max[0], positions[i]);
    max[1] = Math.max(max[1], positions[i + 1]);
    max[2] = Math.max(max[2], positions[i + 2]);
  }

  return {
    pointCount: vertexCount,
    positions,
    colors: hasColor ? colors : null,
    normals: hasNormal ? normals : null,
    boundingBox: { min, max },
  };
}
