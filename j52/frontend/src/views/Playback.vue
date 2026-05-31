<template>
  <div>
    <div class="section-title">
      <el-icon :size="22" color="#8b5cf6"><VideoPlay /></el-icon>
      <span>数据回放</span>
      <el-tag v-if="wsState === 'connected'" type="success" size="small" style="margin-left: 12px;">
        WebSocket 已连接
      </el-tag>
      <el-tag v-else-if="wsState === 'connecting'" type="warning" size="small" style="margin-left: 12px;">
        连接中...
      </el-tag>
      <el-tag v-else type="danger" size="small" style="margin-left: 12px;">
        WebSocket 未连接
      </el-tag>
    </div>

    <div class="chart-container" style="margin-bottom: 24px;">
      <el-row :gutter="16" style="margin-bottom: 16px;">
        <el-col :span="6">
          <label style="font-weight: 500; display: block; margin-bottom: 6px;">起始时间</label>
          <el-date-picker
            v-model="startTime"
            type="datetime"
            placeholder="选择起始时间"
            style="width: 100%;"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DDTHH:mm:ssZ"
          />
        </el-col>
        <el-col :span="6">
          <label style="font-weight: 500; display: block; margin-bottom: 6px;">结束时间</label>
          <el-date-picker
            v-model="stopTime"
            type="datetime"
            placeholder="选择结束时间"
            style="width: 100%;"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DDTHH:mm:ssZ"
          />
        </el-col>
        <el-col :span="6">
          <label style="font-weight: 500; display: block; margin-bottom: 6px;">数据项（多选）</label>
          <el-select
            v-model="selectedRegisters"
            multiple
            placeholder="选择数据项"
            style="width: 100%;"
          >
            <el-option
              v-for="reg in registerList"
              :key="reg.address"
              :label="reg.name"
              :value="reg.name"
            />
          </el-select>
        </el-col>
        <el-col :span="6">
          <label style="font-weight: 500; display: block; margin-bottom: 6px;">回放速度</label>
          <el-select v-model="playbackSpeed" style="width: 100%;">
            <el-option label="1x (原始速度)" :value="1" />
            <el-option label="5x" :value="5" />
            <el-option label="10x (推荐)" :value="10" />
            <el-option label="20x" :value="20" />
            <el-option label="50x" :value="50" />
          </el-select>
        </el-col>
      </el-row>

      <el-row :gutter="16" style="margin-bottom: 16px;">
        <el-col :span="24">
          <div style="display: flex; gap: 12px; align-items: center;">
            <el-button
              type="primary"
              :icon="isPlaying ? null : VideoPlay"
              :disabled="!startTime || !stopTime || selectedRegisters.length === 0"
              @click="startPlayback"
            >
              {{ isPlaying ? '回放中...' : '开始回放' }}
            </el-button>
            <el-button @click="stopPlayback" :disabled="!isPlaying">
              <el-icon><VideoPause /></el-icon>
              停止
            </el-button>
            <el-button @click="resetPlayback">
              <el-icon><RefreshRight /></el-icon>
              重置
            </el-button>

            <div style="flex: 1;"></div>

            <div v-if="playbackMeta" style="font-size: 13px; color: #6b7280;">
              数据量: {{ playbackMeta.total_points }} 点 |
              时间跨度: {{ formatDuration(playbackMeta.time_span_ms) }} |
              回放时长: {{ formatDuration(playbackMeta.real_duration_ms) }}
            </div>
          </div>
        </el-col>
      </el-row>
    </div>

    <div class="chart-container" style="margin-bottom: 24px;">
      <div class="section-title" style="margin-bottom: 20px;">
        <el-icon :size="20" color="#8b5cf6"><TrendCharts /></el-icon>
        <span>动态数据曲线</span>
        <div style="flex: 1;"></div>
        <div v-if="isPlaying" style="font-size: 13px; color: #8b5cf6;">
          <el-icon class="is-loading"><Loading /></el-icon>
          回放中 {{ playbackProgress }}%
        </div>
      </div>
      <v-chart class="chart" :option="chartOption" autoresize />
    </div>

    <div class="chart-container" style="margin-bottom: 24px;">
      <div class="section-title" style="margin-bottom: 16px;">
        <el-icon :size="20" color="#3b82f6"><Timer /></el-icon>
        <span>时间轴</span>
      </div>

      <div style="padding: 0 20px;">
        <el-slider
          v-model="timelinePosition"
          :min="0"
          :max="timelineMax"
          :step="1"
          :show-tooltip="false"
          :disabled="!playbackMeta"
          @change="onTimelineChange"
        />
        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #6b7280; margin-top: 4px;">
          <span>{{ timelineStartLabel }}</span>
          <span>{{ timelineCurrentLabel }}</span>
          <span>{{ timelineEndLabel }}</span>
        </div>
      </div>
    </div>

    <div class="table-container">
      <div class="section-title" style="margin-bottom: 20px;">
        <el-icon :size="20" color="#3b82f6"><Grid /></el-icon>
        <span>当前帧数据</span>
      </div>
      <el-table :data="currentFrameData" stripe style="width: 100%;">
        <el-table-column prop="register_name" label="数据项" width="200" />
        <el-table-column prop="value" label="当前值" width="150">
          <template #default="scope">
            <el-tag>{{ scope.row.value }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="time" label="原始时间" />
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, shallowRef } from 'vue'
import * as echarts from 'echarts'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent,
} from 'echarts/components'
import { getRegisterList } from '../api/api'

use([
  CanvasRenderer,
  LineChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent,
])

const COLOR_PALETTE = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
]

const startTime = ref(null)
const stopTime = ref(null)
const selectedRegisters = ref(['Temperature_Sensor_1', 'Pressure_Sensor_1'])
const playbackSpeed = ref(10)
const registerList = ref([])

const wsState = ref('disconnected')
const isPlaying = ref(false)
const playbackMeta = ref(null)
const playbackProgress = ref(0)

const timelinePosition = ref(0)
const timelineMax = ref(1000)
const timelineStartMs = ref(0)
const timelineEndMs = ref(0)

const chartSeriesData = shallowRef({})
const chartTimes = shallowRef([])
const currentFrameData = ref([])

let ws = null
let animationFrameId = null

const timelineStartLabel = computed(() => {
  if (!timelineStartMs.value) return '--'
  return new Date(timelineStartMs.value).toLocaleString('zh-CN')
})

const timelineEndLabel = computed(() => {
  if (!timelineEndMs.value) return '--'
  return new Date(timelineEndMs.value).toLocaleString('zh-CN')
})

const timelineCurrentLabel = computed(() => {
  if (!timelineStartMs.value || !timelineEndMs.value) return '--'
  const currentMs = timelineStartMs.value +
    (timelinePosition.value / timelineMax.value) * (timelineEndMs.value - timelineStartMs.value)
  return new Date(currentMs).toLocaleString('zh-CN')
})

const chartOption = computed(() => {
  const series = Object.keys(chartSeriesData.value).map((name, idx) => ({
    name,
    type: 'line',
    smooth: true,
    symbol: 'none',
    lineStyle: {
      color: COLOR_PALETTE[idx % COLOR_PALETTE.length],
      width: 2,
    },
    itemStyle: {
      color: COLOR_PALETTE[idx % COLOR_PALETTE.length],
    },
    areaStyle: {
      color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        {
          offset: 0,
          color: COLOR_PALETTE[idx % COLOR_PALETTE.length] + '30',
        },
        {
          offset: 1,
          color: COLOR_PALETTE[idx % COLOR_PALETTE.length] + '05',
        },
      ]),
    },
    data: chartSeriesData.value[name],
  }))

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e5e7eb',
      textStyle: { color: '#1f2937' },
    },
    legend: {
      data: Object.keys(chartSeriesData.value),
      top: 0,
      textStyle: { color: '#6b7280' },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '40px',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: chartTimes.value,
      axisLine: { lineStyle: { color: '#d1d5db' } },
      axisLabel: {
        color: '#6b7280',
        rotate: 30,
        formatter: (val) => {
          if (!val) return ''
          return new Date(val).toLocaleTimeString('zh-CN')
        },
      },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#d1d5db' } },
      axisLabel: { color: '#6b7280' },
      splitLine: { lineStyle: { color: '#f3f4f6' } },
    },
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      { start: 0, end: 100 },
    ],
    series,
  }
})

const formatDuration = (ms) => {
  if (!ms) return '--'
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

const connectWebSocket = () => {
  if (ws && ws.readyState === WebSocket.OPEN) return

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = `${protocol}//${window.location.host}/ws/playback`

  wsState.value = 'connecting'
  ws = new WebSocket(wsUrl)

  ws.onopen = () => {
    wsState.value = 'connected'
  }

  ws.onclose = () => {
    wsState.value = 'disconnected'
    isPlaying.value = false
  }

  ws.onerror = () => {
    wsState.value = 'disconnected'
    isPlaying.value = false
  }

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    handleWsMessage(msg)
  }
}

const handleWsMessage = (msg) => {
  switch (msg.type) {
    case 'meta':
      playbackMeta.value = msg
      chartSeriesData.value = {}
      chartTimes.value = []
      msg.register_names.forEach((name) => {
        chartSeriesData.value[name] = []
      })
      chartSeriesData.value = { ...chartSeriesData.value }
      timelineStartMs.value = 0
      timelineEndMs.value = msg.time_span_ms
      timelinePosition.value = 0
      break

    case 'data':
      const points = msg.points
      if (!points || points.length === 0) break

      const newTimes = [...chartTimes.value]
      const newSeries = { ...chartSeriesData.value }
      const frameMap = {}

      for (const pt of points) {
        const timeLabel = pt.time
        if (!newTimes.includes(timeLabel)) {
          newTimes.push(timeLabel)
        }

        if (newSeries[pt.register_name] !== undefined) {
          newSeries[pt.register_name] = [...newSeries[pt.register_name], [timeLabel, pt.value]]
        }

        frameMap[pt.register_name] = {
          register_name: pt.register_name,
          value: pt.value,
          time: pt.time,
        }
      }

      chartTimes.value = newTimes
      chartSeriesData.value = newSeries

      if (timelineEndMs.value > 0 && playbackMeta.value) {
        const lastPt = points[points.length - 1]
        const firstPtMs = playbackMeta.value.time_span_ms > 0
          ? (lastPt.timestamp_ms - (timelineStartMs.value || 0))
          : 0
        timelinePosition.value = Math.min(
          Math.round((firstPtMs / playbackMeta.value.time_span_ms) * timelineMax.value),
          timelineMax.value,
        )
      }

      playbackProgress.value = Math.round((msg.progress / msg.total) * 100)

      currentFrameData.value = Object.values(frameMap).sort((a, b) =>
        a.register_name.localeCompare(b.register_name),
      )
      break

    case 'done':
      isPlaying.value = false
      playbackProgress.value = 100
      timelinePosition.value = timelineMax.value
      break

    case 'error':
      isPlaying.value = false
      console.error('Playback error:', msg.message)
      break

    case 'stopped':
      isPlaying.value = false
      break
  }
}

const startPlayback = () => {
  if (!startTime.value || !stopTime.value || selectedRegisters.value.length === 0) return

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    connectWebSocket()
    setTimeout(() => {
      _sendStartCommand()
    }, 500)
  } else {
    _sendStartCommand()
  }
}

const _sendStartCommand = () => {
  chartSeriesData.value = {}
  chartTimes.value = []
  currentFrameData.value = []
  playbackMeta.value = null
  playbackProgress.value = 0
  timelinePosition.value = 0

  const start = startTime.value
  const stop = stopTime.value

  const payload = {
    command: 'start',
    start_time: start,
    stop_time: stop,
    register_names: selectedRegisters.value,
    speed: playbackSpeed.value,
  }

  ws.send(JSON.stringify(payload))
  isPlaying.value = true
}

const stopPlayback = () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ command: 'stop' }))
  }
  isPlaying.value = false
}

const resetPlayback = () => {
  stopPlayback()
  chartSeriesData.value = {}
  chartTimes.value = []
  currentFrameData.value = []
  playbackMeta.value = null
  playbackProgress.value = 0
  timelinePosition.value = 0
}

const onTimelineChange = (val) => {
  // Visual-only: the slider position is driven by the playback
}

onMounted(async () => {
  try {
    const regs = await getRegisterList()
    registerList.value = regs
  } catch (error) {
    console.error('Failed to load register list:', error)
  }

  connectWebSocket()
})

onUnmounted(() => {
  if (ws) {
    ws.close()
    ws = null
  }
})
</script>

<style scoped>
.chart {
  height: 400px;
  width: 100%;
}
</style>
