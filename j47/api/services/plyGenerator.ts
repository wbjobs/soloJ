export interface PointCloudData {
  positions: number[]
  colors: number[] | null
  normals: number[] | null
  pointCount: number
}

export function generatePLY(
  data: PointCloudData,
  indices: number[]
): Buffer {
  const selectedCount = indices.length

  const headerLines: string[] = []
  headerLines.push('ply')
  headerLines.push('format ascii 1.0')
  headerLines.push(`element vertex ${selectedCount}`)
  headerLines.push('property float x')
  headerLines.push('property float y')
  headerLines.push('property float z')

  const hasColors = data.colors !== null && data.colors.length > 0
  const hasNormals = data.normals !== null && data.normals.length > 0

  if (hasColors) {
    headerLines.push('property uchar red')
    headerLines.push('property uchar green')
    headerLines.push('property uchar blue')
  }

  if (hasNormals) {
    headerLines.push('property float nx')
    headerLines.push('property float ny')
    headerLines.push('property float nz')
  }

  headerLines.push('end_header')

  const header = headerLines.join('\n') + '\n'
  const headerBuffer = Buffer.from(header, 'ascii')

  const dataParts: string[] = []

  for (const idx of indices) {
    const posIdx = idx * 3
    const x = data.positions[posIdx]
    const y = data.positions[posIdx + 1]
    const z = data.positions[posIdx + 2]

    let line = `${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}`

    if (hasColors && data.colors) {
      const colIdx = idx * 3
      const r = Math.min(255, Math.max(0, Math.round(data.colors[colIdx] * 255)))
      const g = Math.min(255, Math.max(0, Math.round(data.colors[colIdx + 1] * 255)))
      const b = Math.min(255, Math.max(0, Math.round(data.colors[colIdx + 2] * 255)))
      line += ` ${r} ${g} ${b}`
    }

    if (hasNormals && data.normals) {
      const normIdx = idx * 3
      const nx = data.normals[normIdx]
      const ny = data.normals[normIdx + 1]
      const nz = data.normals[normIdx + 2]
      line += ` ${nx.toFixed(6)} ${ny.toFixed(6)} ${nz.toFixed(6)}`
    }

    dataParts.push(line)
  }

  const dataStr = dataParts.join('\n') + '\n'
  const dataBuffer = Buffer.from(dataStr, 'ascii')

  return Buffer.concat([headerBuffer, dataBuffer])
}
