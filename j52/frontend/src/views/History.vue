<template>
  <div>
    <div class="section-title">
      <el-icon :size="22" color="#3b82f6"><DataLine /></el-icon>
      <span>历史数据分析</span>
    </div>

    <div class="chart-container" style="margin-bottom: 24px;">
      <el-row :gutter="16" style="margin-bottom: 20px;">
        <el-col :span="8">
          <label style="font-weight: 500; margin-right: 8px;">选择数据项:</label>
          <el-select
            v-model="selectedRegister"
            placeholder="请选择"
            style="width: 100%;"
            @change="fetchHistoryData"
          >
            <el-option
              v-for="reg in registerList"
              :key="reg.address"
              :label="reg.name"
              :value="reg.name"
            />
          </el-select>
        </el-col>
        <el-col :span="8">
          <label style="font-weight: 500; margin-right: 8px;">时间范围:</label>
          <el-select
            v-model="timeRange"
            placeholder="请选择"
            style="width: 100%;"
            @change="fetchHistoryData"
          >
            <el-option label="最近 1 小时" value="-1h" />
            <el-option label="最近 6 小时" value="-6h" />
            <el-option label="最近 24 小时" value="-24h" />
            <el-option label="最近 7 天" value="-7d" />
          </el-select>
        </el-col>
        <el-col :span="8">
          <label style="font-weight: 500; margin-right: 8px;">设备:</label>
          <el-select
            v-model="selectedDevice"
            placeholder="全部设备"
            style="width: 100%;"
            @change="fetchHistoryData"
            clearable
          >
            <el-option
              v-for="dev in devices"
              :key="dev.device_id"
              :label="dev.device_name"
              :value="dev.device_id"
            />
          </el-select>
        </el-col>
      </el-row>

      <v-chart class="chart" :option="chartOption" autoresize />
    </div>

    <div class="table-container">
      <div class="section-title" style="margin-bottom: 20px;">
        <el-icon :size="20" color="#3b82f6"><Document /></el-icon>
        <span>数据统计</span>
      </div>
      <el-row :gutter="16">
        <el-col :span="6">
          <div class="data-card">
            <div class="card-title">数据点数</div>
            <div class="card-value">{{ historyData.data_points || 0 }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="data-card">
            <div class="card-title">最大值</div>
            <div class="card-value" style="color: #ef4444;">
              {{ statistics.max.toFixed(2) }}
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="data-card">
            <div class="card-title">最小值</div>
            <div class="card-value" style="color: #10b981;">
              {{ statistics.min.toFixed(2) }}
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="data-card">
            <div class="card-title">平均值</div>
            <div class="card-value" style="color: #3b82f6;">
              {{ statistics.avg.toFixed(2) }}
            </div>
          </div>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
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
import { getRegisterList, getDevices, getHistoryData } from '../api/api'

use([
  CanvasRenderer,
  LineChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent,
])

const selectedRegister = ref('Temperature_Sensor_1')
const timeRange = ref('-1h')
const selectedDevice = ref(null)
const registerList = ref([])
const devices = ref([])
const historyData = ref({ data: [], data_points: 0 })

const statistics = computed(() => {
  const values = historyData.value.data.map((d) => d.value)
  if (values.length === 0) {
    return { max: 0, min: 0, avg: 0 }
  }
  return {
    max: Math.max(...values),
    min: Math.min(...values),
    avg: values.reduce((a, b) => a + b, 0) / values.length,
  }
})

const chartOption = computed(() => ({
  tooltip: {
    trigger: 'axis',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderColor: '#e5e7eb',
    textStyle: {
      color: '#1f2937',
    },
  },
  grid: {
    left: '3%',
    right: '4%',
    bottom: '15%',
    containLabel: true,
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: historyData.value.data.map((d) =>
      new Date(d.time).toLocaleString('zh-CN')
    ),
    axisLine: {
      lineStyle: {
        color: '#d1d5db',
      },
    },
    axisLabel: {
      color: '#6b7280',
      rotate: 45,
    },
  },
  yAxis: {
    type: 'value',
    axisLine: {
      lineStyle: {
        color: '#d1d5db',
      },
    },
    axisLabel: {
      color: '#6b7280',
    },
    splitLine: {
      lineStyle: {
        color: '#f3f4f6',
      },
    },
  },
  dataZoom: [
    {
      type: 'inside',
      start: 0,
      end: 100,
    },
    {
      start: 0,
      end: 100,
    },
  ],
  series: [
    {
      name: selectedRegister.value,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 4,
      lineStyle: {
        color: '#8b5cf6',
        width: 2,
      },
      itemStyle: {
        color: '#8b5cf6',
      },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(139, 92, 246, 0.3)' },
          { offset: 1, color: 'rgba(139, 92, 246, 0.05)' },
        ]),
      },
      data: historyData.value.data.map((d) => d.value),
    },
  ],
}))

const fetchHistoryData = async () => {
  try {
    const data = await getHistoryData(
      selectedRegister.value,
      selectedDevice.value,
      timeRange.value
    )
    historyData.value = data
  } catch (error) {
    console.error('Failed to fetch history data:', error)
  }
}

onMounted(async () => {
  try {
    const [regList, devList] = await Promise.all([
      getRegisterList(),
      getDevices(),
    ])
    registerList.value = regList
    devices.value = devList
    fetchHistoryData()
  } catch (error) {
    console.error('Failed to load initial data:', error)
  }
})
</script>

<style scoped>
.chart {
  height: 400px;
  width: 100%;
}
</style>
