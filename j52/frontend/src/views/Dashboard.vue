<template>
  <div>
    <div class="section-title">
      <el-icon :size="22" color="#3b82f6"><Odometer /></el-icon>
      <span>实时数据监控</span>
      <el-tag type="success" size="small" style="margin-left: 12px;">
        自动刷新中
      </el-tag>
    </div>

    <el-row :gutter="16" style="margin-bottom: 24px;">
      <el-col :span="6">
        <div class="data-card">
          <div class="card-title">设备总数</div>
          <div class="card-value">{{ stats.total_devices || 0 }}</div>
          <div class="card-trend">
            <el-icon color="#3b82f6"><Connection /></el-icon>
            <span style="margin-left: 4px; color: #3b82f6;">在线设备</span>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="data-card">
          <div class="card-title">监控指标</div>
          <div class="card-value">{{ stats.total_points || 0 }}</div>
          <div class="card-trend">
            <el-icon color="#8b5cf6"><DataAnalysis /></el-icon>
            <span style="margin-left: 4px; color: #8b5cf6;">数据点位</span>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="data-card">
          <div class="card-title">轮询频率</div>
          <div class="card-value">1<span class="card-unit">秒</span></div>
          <div class="card-trend">
            <el-icon color="#f59e0b"><Timer /></el-icon>
            <span style="margin-left: 4px; color: #f59e0b;">实时更新</span>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="data-card">
          <div class="card-title">最近更新</div>
          <div class="card-value" style="font-size: 18px;">
            {{ formatTime(stats.latest_update) }}
          </div>
          <div class="card-trend">
            <el-icon color="#10b981"><CheckCircle /></el-icon>
            <span style="margin-left: 4px; color: #10b981;">系统正常</span>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-bottom: 24px;">
      <el-col :span="24">
        <div class="chart-container">
          <div class="section-title" style="margin-bottom: 20px;">
            <el-icon :size="20" color="#3b82f6"><TrendCharts /></el-icon>
            <span>实时数据趋势</span>
            <el-select
              v-model="selectedRegister"
              placeholder="选择数据项"
              size="small"
              style="margin-left: 16px; width: 200px;"
            >
              <el-option
                v-for="reg in registerList"
                :key="reg.address"
                :label="reg.name"
                :value="reg.name"
              />
            </el-select>
          </div>
          <v-chart class="chart" :option="chartOption" autoresize />
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-bottom: 24px;">
      <el-col :span="12">
        <div class="chart-container">
          <div class="section-title" style="margin-bottom: 20px;">
            <el-icon :size="20" color="#8b5cf6"><Temperature /></el-icon>
            <span>温度监控</span>
          </div>
          <el-row :gutter="12">
            <el-col :span="12">
              <div class="data-card" style="background: linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%);">
                <div class="card-title" style="color: #92400e;">温度传感器 1</div>
                <div class="card-value" style="color: #b45309;">
                  {{ getRegisterValue('Temperature_Sensor_1') }}
                  <span class="card-unit" style="color: #92400e;">°C</span>
                </div>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="data-card" style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);">
                <div class="card-title" style="color: #1e40af;">温度传感器 2</div>
                <div class="card-value" style="color: #2563eb;">
                  {{ getRegisterValue('Temperature_Sensor_2') }}
                  <span class="card-unit" style="color: #1e40af;">°C</span>
                </div>
              </div>
            </el-col>
          </el-row>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="chart-container">
          <div class="section-title" style="margin-bottom: 20px;">
            <el-icon :size="20" color="#ef4444"><Gauge /></el-icon>
            <span>压力监控</span>
          </div>
          <el-row :gutter="12">
            <el-col :span="12">
              <div class="data-card" style="background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);">
                <div class="card-title" style="color: #991b1b;">压力传感器 1</div>
                <div class="card-value" style="color: #dc2626;">
                  {{ getRegisterValue('Pressure_Sensor_1') }}
                  <span class="card-unit" style="color: #991b1b;">kPa</span>
                </div>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="data-card" style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);">
                <div class="card-title" style="color: #065f46;">压力传感器 2</div>
                <div class="card-value" style="color: #059669;">
                  {{ getRegisterValue('Pressure_Sensor_2') }}
                  <span class="card-unit" style="color: #065f46;">kPa</span>
                </div>
              </div>
            </el-col>
          </el-row>
        </div>
      </el-col>
    </el-row>

    <div class="table-container">
      <div class="section-title" style="margin-bottom: 20px;">
        <el-icon :size="20" color="#3b82f6"><Grid /></el-icon>
        <span>所有寄存器实时数据</span>
      </div>
      <el-table :data="latestData" stripe style="width: 100%;">
        <el-table-column prop="register_address" label="地址" width="100" />
        <el-table-column prop="register_name" label="数据项" width="200" />
        <el-table-column prop="value" label="当前值" width="150">
          <template #default="scope">
            <el-tag :type="getValueTagType(scope.row.register_name)">
              {{ scope.row.value }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="device_id" label="设备ID" width="150" />
        <el-table-column prop="device_name" label="设备名称" width="200" />
        <el-table-column prop="time" label="更新时间">
          <template #default="scope">
            {{ formatTime(scope.row.time) }}
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
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
} from 'echarts/components'
import { getLatestData, getStats, getRegisterList, getHistoryData } from '../api/api'

use([
  CanvasRenderer,
  LineChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
])

const stats = ref({})
const latestData = ref([])
const registerList = ref([])
const selectedRegister = ref('Temperature_Sensor_1')
const chartData = ref({ times: [], values: [] })

let dataInterval = null

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
    bottom: '3%',
    containLabel: true,
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: chartData.value.times,
    axisLine: {
      lineStyle: {
        color: '#d1d5db',
      },
    },
    axisLabel: {
      color: '#6b7280',
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
  series: [
    {
      name: selectedRegister.value,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: {
        color: '#3b82f6',
        width: 3,
      },
      itemStyle: {
        color: '#3b82f6',
      },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
          { offset: 1, color: 'rgba(59, 130, 246, 0.05)' },
        ]),
      },
      data: chartData.value.values,
    },
  ],
}))

const formatTime = (time) => {
  if (!time) return '--'
  return new Date(time).toLocaleString('zh-CN')
}

const getRegisterValue = (name) => {
  const item = latestData.value.find((d) => d.register_name === name)
  return item ? item.value : '--'
}

const getValueTagType = (name) => {
  if (name.includes('Temperature')) return 'warning'
  if (name.includes('Pressure')) return 'danger'
  if (name.includes('Status')) return 'success'
  return 'primary'
}

const fetchData = async () => {
  try {
    const [data, statData, regList] = await Promise.all([
      getLatestData(),
      getStats(),
      getRegisterList(),
    ])
    latestData.value = data.sort((a, b) => a.register_address - b.register_address)
    stats.value = statData
    registerList.value = regList
  } catch (error) {
    console.error('Failed to fetch data:', error)
  }
}

const fetchChartData = async () => {
  try {
    const data = await getHistoryData(selectedRegister.value, null, '-10m')
    chartData.value = {
      times: data.data.map((d) => new Date(d.time).toLocaleTimeString('zh-CN')),
      values: data.data.map((d) => d.value),
    }
  } catch (error) {
    console.error('Failed to fetch chart data:', error)
  }
}

onMounted(() => {
  fetchData()
  fetchChartData()
  
  dataInterval = setInterval(() => {
    fetchData()
    fetchChartData()
  }, 2000)
})

onUnmounted(() => {
  if (dataInterval) {
    clearInterval(dataInterval)
  }
})
</script>

<style scoped>
.chart {
  height: 350px;
  width: 100%;
}
</style>
