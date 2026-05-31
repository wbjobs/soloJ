export default class WaveformRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.width = options.width || canvas.width
    this.height = options.height || canvas.height
    this.signalCount = options.signalCount || 4
    this.colors = options.colors || [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
      '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
    ]
    this.sampleRate = options.sampleRate || 1000000
    this.timeWindow = options.timeWindow || { start: 0, end: 0.01 }
    this.zoomLevel = 1
    this.panOffset = 0
    this.visibleSignals = new Set()
    this._signalYPositions = []
  }

  clear() {
    this.ctx.fillStyle = '#0f172a'
    this.ctx.fillRect(0, 0, this.width, this.height)
  }

  render(signals, cursorPosition, markers) {
    this.clear()

    const timeStart = this.timeWindow.start + this.panOffset
    const timeEnd = this.timeWindow.end + this.panOffset
    const timeSpan = (timeEnd - timeStart) / this.zoomLevel
    const adjustedStart = timeStart + (timeSpan - (timeEnd - timeStart)) / 2
    const adjustedEnd = adjustedStart + (timeEnd - timeStart) / this.zoomLevel

    const signalAreaHeight = this.height - 40
    const signalHeight = signalAreaHeight / Math.max(this.signalCount, 1)
    const yPositions = []

    for (let i = 0; i < this.signalCount; i++) {
      yPositions.push(40 + i * signalHeight)
    }
    this._signalYPositions = yPositions

    this.drawGrid(this.ctx, this.width, this.height, adjustedStart, adjustedEnd, this.signalCount)
    this.drawLabels(this.ctx, signals, yPositions, signalHeight)

    if (signals && signals.length > 0) {
      signals.forEach((signal, index) => {
        if (signal.hidden) return
        const y = yPositions[index] || 40
        const color = signal.color || this.colors[index % this.colors.length]

        if (signal.isAnalog) {
          const { min, max } = this._getAnalogRange(signal.data)
          this.drawAnalogSignal(
            this.ctx, signal, y, signalHeight - 4,
            60, this.width, adjustedStart, adjustedEnd, min, max
          )
        } else {
          this.drawDigitalSignal(
            this.ctx, signal, y, signalHeight - 4,
            60, this.width, adjustedStart, adjustedEnd
          )
        }
      })
    }

    if (cursorPosition !== null && cursorPosition !== undefined) {
      const x = this.getPositionAtTime(cursorPosition)
      if (x >= 60 && x <= this.width) {
        this.drawCursor(this.ctx, x, this.height)
      }
    }

    if (markers && markers.length > 0) {
      this.drawMarkers(this.ctx, markers, this.height)
    }
  }

  drawGrid(ctx, width, height, timeStart, timeEnd, signalCount) {
    const leftMargin = 60
    const labelHeight = 40
    const signalAreaHeight = height - labelHeight

    ctx.strokeStyle = 'rgba(71, 85, 105, 0.4)'
    ctx.lineWidth = 1

    const signalHeight = signalAreaHeight / Math.max(signalCount, 1)
    for (let i = 0; i <= signalCount; i++) {
      const y = labelHeight + i * signalHeight
      ctx.beginPath()
      ctx.moveTo(leftMargin, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    const timeSpan = timeEnd - timeStart
    const gridSteps = this._calculateGridSteps(timeSpan)
    const firstStep = Math.ceil(timeStart / gridSteps) * gridSteps

    ctx.font = '10px ui-monospace, monospace'
    ctx.fillStyle = '#94a3b8'
    ctx.textAlign = 'center'

    for (let t = firstStep; t <= timeEnd; t += gridSteps) {
      const x = leftMargin + ((t - timeStart) / timeSpan) * (width - leftMargin)
      if (x >= leftMargin && x <= width) {
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.3)'
        ctx.beginPath()
        ctx.moveTo(x, labelHeight)
        ctx.lineTo(x, height)
        ctx.stroke()

        const label = this._formatTime(t)
        ctx.fillText(label, x, 12)
      }
    }

    ctx.strokeStyle = 'rgba(71, 85, 105, 0.6)'
    ctx.beginPath()
    ctx.moveTo(leftMargin, labelHeight)
    ctx.lineTo(leftMargin, height)
    ctx.lineTo(width, height)
    ctx.stroke()

    ctx.strokeStyle = 'rgba(71, 85, 105, 0.6)'
    ctx.beginPath()
    ctx.moveTo(leftMargin, labelHeight)
    ctx.lineTo(width, labelHeight)
    ctx.stroke()
  }

  _calculateGridSteps(timeSpan) {
    const rawStep = timeSpan / 10
    const magnitudes = [0.000000001, 0.00000001, 0.0000001, 0.000001, 0.00001, 0.0001, 0.001, 0.01, 0.1, 1, 10, 100, 1000]
    const multipliers = [1, 2, 5]

    let bestStep = magnitudes[magnitudes.length - 1]
    let bestDiff = Infinity

    for (const mag of magnitudes) {
      for (const mult of multipliers) {
        const step = mag * mult
        const diff = Math.abs(step - rawStep)
        if (diff < bestDiff) {
          bestDiff = diff
          bestStep = step
        }
      }
    }

    return bestStep
  }

  _formatTime(time) {
    if (Math.abs(time) >= 1) {
      return `${time.toFixed(3)}s`
    } else if (Math.abs(time) >= 0.001) {
      return `${(time * 1000).toFixed(3)}ms`
    } else if (Math.abs(time) >= 0.000001) {
      return `${(time * 1000000).toFixed(3)}us`
    } else {
      return `${(time * 1000000000).toFixed(2)}ns`
    }
  }

  drawLabels(ctx, signals, yPositions, signalHeight) {
    ctx.font = '11px ui-monospace, monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'

    if (!signals) return

    signals.forEach((signal, index) => {
      const y = yPositions[index]
      if (y === undefined) return
      const color = signal.color || this.colors[index % this.colors.length]

      ctx.fillStyle = 'rgba(30, 41, 59, 0.95)'
      ctx.fillRect(0, y, 60, signalHeight)

      ctx.strokeStyle = 'rgba(71, 85, 105, 0.4)'
      ctx.beginPath()
      ctx.moveTo(60, y)
      ctx.lineTo(60, y + signalHeight)
      ctx.stroke()

      ctx.fillStyle = color
      ctx.fillRect(4, y + signalHeight / 2 - 2, 8, 4)

      ctx.fillStyle = signal.hidden ? '#475569' : '#e2e8f0'
      ctx.fillText(signal.name || `CH${index}`, 16, y + signalHeight / 2)
    })
  }

  drawDigitalSignal(ctx, signal, y, height, startX, endX, timeStart, timeEnd) {
    if (!signal.data || signal.data.length === 0) return

    const timeSpan = timeEnd - timeStart
    const pixelPerTime = (endX - startX) / timeSpan
    const color = signal.color || '#3b82f6'
    const midY = y + height / 2

    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.beginPath()

    const data = signal.data
    let started = false

    for (let i = 0; i < data.length - 1; i++) {
      const t0 = data[i].time
      const t1 = data[i + 1].time
      const v0 = data[i].value
      const v1 = data[i + 1].value

      if (t1 < timeStart || t0 > timeEnd) continue

      const x0 = Math.max(startX, startX + (t0 - timeStart) * pixelPerTime)
      const x1 = Math.min(endX, startX + (t1 - timeStart) * pixelPerTime)

      if (t0 >= timeStart || t1 <= timeEnd) {
        const y0 = v0 > 0.5 ? y + 2 : y + height - 2
        if (!started) {
          ctx.moveTo(x0, y0)
          started = true
        } else {
          ctx.lineTo(x0, y0)
        }

        if (v0 !== v1) {
          const y1 = v1 > 0.5 ? y + 2 : y + height - 2
          ctx.lineTo(x1, y0)
          ctx.lineTo(x1, y1)
        } else {
          ctx.lineTo(x1, y0)
        }
      }
    }

    if (data.length > 0) {
      const lastSample = data[data.length - 1]
      if (lastSample.time <= timeEnd) {
        const xLast = startX + (lastSample.time - timeStart) * pixelPerTime
        const yLast = lastSample.value > 0.5 ? y + 2 : y + height - 2
        if (!started) {
          ctx.moveTo(Math.max(startX, xLast), yLast)
        } else {
          ctx.lineTo(Math.max(startX, xLast), yLast)
        }
        ctx.lineTo(endX, yLast)
      }
    }

    ctx.stroke()
  }

  drawAnalogSignal(ctx, signal, y, height, startX, endX, timeStart, timeEnd, minVal, maxVal) {
    if (!signal.data || signal.data.length === 0) return

    const timeSpan = timeEnd - timeStart
    const pixelPerTime = (endX - startX) / timeSpan
    const color = signal.color || '#3b82f6'
    const valueRange = (maxVal - minVal) || 1

    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.beginPath()

    const data = signal.data
    let started = false

    for (let i = 0; i < data.length; i++) {
      const t = data[i].time
      const v = data[i].value

      if (t < timeStart || t > timeEnd) continue

      const x = startX + (t - timeStart) * pixelPerTime
      const normalizedVal = (v - minVal) / valueRange
      const yVal = y + height - 2 - normalizedVal * (height - 4)

      if (!started) {
        ctx.moveTo(x, yVal)
        started = true
      } else {
        ctx.lineTo(x, yVal)
      }
    }

    ctx.stroke()
  }

  drawCursor(ctx, x, height) {
    ctx.strokeStyle = '#fbbf24'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
    ctx.setLineDash([])

    const label = this._formatTime(this.getTimeAtPosition(x))
    ctx.font = '10px ui-monospace, monospace'
    const textWidth = ctx.measureText(label).width
    const labelX = Math.min(Math.max(x - textWidth / 2 - 4, 60), this.width - textWidth - 8)

    ctx.fillStyle = '#fbbf24'
    ctx.fillRect(labelX, 2, textWidth + 8, 16)
    ctx.fillStyle = '#0f172a'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, labelX + 4, 10)
  }

  drawMarkers(ctx, markers, height) {
    if (!markers || markers.length === 0) return

    markers.forEach((marker) => {
      const x = this.getPositionAtTime(marker.time)
      if (x < 60 || x > this.width) return

      ctx.strokeStyle = marker.color || '#a78bfa'
      ctx.lineWidth = 1
      ctx.setLineDash([2, 4])
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
      ctx.setLineDash([])

      const label = marker.label || 'M'
      ctx.font = '10px ui-monospace, monospace'
      const textWidth = ctx.measureText(label).width
      const labelX = Math.min(Math.max(x - textWidth / 2 - 4, 60), this.width - textWidth - 8)

      ctx.fillStyle = marker.color || '#a78bfa'
      ctx.fillRect(labelX, 20, textWidth + 8, 16)
      ctx.fillStyle = '#0f172a'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, labelX + 4, 28)
    })
  }

  getSignalAtPosition(x) {
    const leftMargin = 60
    const labelHeight = 40
    if (x < leftMargin) {
      const signalAreaHeight = this.height - labelHeight
      const signalHeight = signalAreaHeight / Math.max(this.signalCount, 1)
      return Math.floor((x - labelHeight) / signalHeight)
    }
    return -1
  }

  getTimeAtPosition(x) {
    const leftMargin = 60
    const timeStart = this.timeWindow.start + this.panOffset
    const timeEnd = this.timeWindow.end + this.panOffset
    const timeSpan = (timeEnd - timeStart) / this.zoomLevel
    const adjustedStart = timeStart + (timeSpan - (timeEnd - timeStart)) / 2

    const relativeX = (x - leftMargin) / (this.width - leftMargin)
    return adjustedStart + relativeX * (timeSpan)
  }

  getPositionAtTime(time) {
    const leftMargin = 60
    const timeStart = this.timeWindow.start + this.panOffset
    const timeEnd = this.timeWindow.end + this.panOffset
    const timeSpan = (timeEnd - timeStart) / this.zoomLevel
    const adjustedStart = timeStart + (timeSpan - (timeEnd - timeStart)) / 2

    const relativeTime = (time - adjustedStart) / timeSpan
    return leftMargin + relativeTime * (this.width - leftMargin)
  }

  zoom(factor, centerX) {
    const timeAtCenter = this.getTimeAtPosition(centerX)
    this.zoomLevel = Math.max(0.1, Math.min(100, this.zoomLevel * factor))
    const newTimeAtCenter = this.getTimeAtPosition(centerX)
    this.panOffset += (timeAtCenter - newTimeAtCenter)
  }

  pan(deltaX) {
    const leftMargin = 60
    const timeStart = this.timeWindow.start + this.panOffset
    const timeEnd = this.timeWindow.end + this.panOffset
    const timeSpan = (timeEnd - timeStart) / this.zoomLevel
    const pixelPerTime = (this.width - leftMargin) / timeSpan
    this.panOffset -= deltaX / pixelPerTime
  }

  setTimeWindow(start, end) {
    this.timeWindow = { start, end }
    this.panOffset = 0
    this.zoomLevel = 1
  }

  autoScale(signals) {
    if (!signals || signals.length === 0) return

    let minTime = Infinity
    let maxTime = -Infinity

    signals.forEach((signal) => {
      if (!signal.data || signal.data.length === 0) return
      const first = signal.data[0].time
      const last = signal.data[signal.data.length - 1].time
      if (first < minTime) minTime = first
      if (last > maxTime) maxTime = last
    })

    if (minTime !== Infinity && maxTime !== -Infinity && maxTime > minTime) {
      const padding = (maxTime - minTime) * 0.05
      this.setTimeWindow(minTime - padding, maxTime + padding)
    }
  }

  _getAnalogRange(data) {
    if (!data || data.length === 0) return { min: 0, max: 1 }
    let min = Infinity
    let max = -Infinity
    for (const point of data) {
      if (point.value < min) min = point.value
      if (point.value > max) max = point.value
    }
    if (min === max) {
      min = min - 1
      max = max + 1
    }
    return { min, max }
  }

  exportPNG() {
    return this.canvas.toDataURL('image/png')
  }

  setSize(width, height) {
    this.width = width
    this.height = height
    this.canvas.width = width
    this.canvas.height = height
  }
}
