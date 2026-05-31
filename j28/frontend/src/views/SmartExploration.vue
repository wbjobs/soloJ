<template>
  <div class="smart-exploration">
    <div class="page-card">
      <div class="card-header">
        <h3>智能实验探索</h3>
        <div class="header-info">
          <el-tag v-if="exploring" type="warning" effect="dark">探索中...</el-tag>
          <el-tag v-else type="success" effect="dark">就绪</el-tag>
        </div>
      </div>

      <el-form :model="exploreForm" label-width="120px">
        <el-row :gutter="24">
          <el-col :span="8">
            <el-form-item label="目标服务">
              <el-select v-model="exploreForm.serviceName" placeholder="选择服务" style="width: 100%">
                <el-option v-for="service in services" :key="service" :label="service" :value="service" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="实验数量">
              <el-input-number v-model="exploreForm.experimentCount" :min="1" :max="10" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="算法配置">
              <el-button type="primary" @click="startExploration" :loading="exploring">
                <el-icon><Cpu /></el-icon>
                开始探索
              </el-button>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <el-alert
        title="遗传算法说明"
        type="info"
        :closable="false"
        description="系统将使用遗传算法自动生成故障组合（延迟+异常+资源耗尽），通过历史实验数据评估适应度，寻找系统的脆弱点。"
      />
    </div>

    <div class="page-card" v-if="explorationResult">
      <div class="card-header">
        <h3>探索结果</h3>
        <div class="header-actions">
          <el-button type="success" @click="executeAutoExperiments" :disabled="exploring">
            <el-icon><VideoPlay /></el-icon>
            执行自动实验
          </el-button>
          <el-button type="primary" @click="showReport = true">
            <el-icon><Document /></el-icon>
            查看报告
          </el-button>
        </div>
      </div>

      <el-descriptions :column="2" border>
        <el-descriptions-item label="探索ID">{{ explorationResult.explorationId }}</el-descriptions-item>
        <el-descriptions-item label="目标服务">{{ explorationResult.serviceName }}</el-descriptions-item>
        <el-descriptions-item label="开始时间">{{ formatDate(explorationResult.startTime) }}</el-descriptions-item>
        <el-descriptions-item label="最优组合数">{{ explorationResult.optimalCombinations?.length || 0 }}</el-descriptions-item>
      </el-descriptions>

      <el-row :gutter="16" style="margin-top: 24px">
        <el-col :span="12" v-for="(combo, index) in topCombinations" :key="combo.id">
          <div class="combination-card" :class="{'top-combo': index === 0}">
            <div class="combo-header">
              <span class="combo-rank">#{{ index + 1 }}</span>
              <el-tag v-if="index === 0" type="danger" effect="dark">最优</el-tag>
              <span class="combo-fitness">适应度: {{ combo.fitness?.toFixed(3) }}</span>
            </div>
            <div class="combo-genes">
              <div v-for="gene in getActiveGenes(combo)" :key="gene.type" class="gene-item">
                <el-tag :type="getGeneTagType(gene.type)" size="small">
                  {{ getGeneTypeName(gene.type) }}
                </el-tag>
                <span class="gene-detail">
                  强度: {{ gene.intensity?.toFixed(0) }}% | 
                  持续: {{ gene.duration }}s | 
                  概率: {{ (gene.probability * 100)?.toFixed(0) }}%
                </span>
              </div>
              <el-empty v-if="getActiveGenes(combo).length === 0" description="无活跃故障" :image-size="60" />
            </div>
            <el-button type="primary" link size="small" @click="viewYaml(combo)">
              查看YAML配置
            </el-button>
          </div>
        </el-col>
      </el-row>
    </div>

    <el-dialog v-model="showReport" title="探索报告" width="70%">
      <div class="report-content">
        <pre>{{ explorationResult?.report }}</pre>
      </div>
    </el-dialog>

    <el-dialog v-model="showYamlDialog" title="YAML配置" width="50%">
      <div class="yaml-content">
        <pre>{{ currentYaml }}</pre>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { startExploration as startExplore, executeAutoExperiments as executeAuto } from '@/api/exploration'
import { getAllServices } from '@/api/service'

const exploring = ref(false)
const services = ref(['order-service', 'payment-service', 'user-service', 'inventory-service', 'gateway-service'])
const explorationResult = ref(null)
const showReport = ref(false)
const showYamlDialog = ref(false)
const currentYaml = ref('')

const exploreForm = ref({
  serviceName: 'order-service',
  experimentCount: 5
})

const topCombinations = computed(() => {
  return explorationResult.value?.optimalCombinations?.slice(0, 4) || []
})

function loadServices() {
  getAllServices().then(res => {
    const unique = [...new Set(res.map(s => s.serviceName))]
    if (unique.length > 0) {
      services.value = unique
    }
  }).catch(() => {})
}

function startExploration() {
  exploring.value = true
  startExplore(exploreForm.value).then(res => {
    explorationResult.value = res
    ElMessage.success('探索完成！')
  }).catch(() => {
    ElMessage.error('探索失败')
  }).finally(() => {
    exploring.value = false
  })
}

function executeAutoExperiments() {
  if (!explorationResult.value) return

  ElMessage.info('自动实验已提交执行')
  executeAuto({
    serviceName: exploreForm.value.serviceName,
    combinations: explorationResult.value.optimalCombinations?.slice(0, 3)
  }).then(() => {
    ElMessage.success('自动实验已启动')
  })
}

function getActiveGenes(combo) {
  if (!combo?.genes) return []
  return Object.values(combo.genes).filter(g => g.enabled)
}

function getGeneTypeName(type) {
  const names = {
    'latency': '延迟注入',
    'exception': '异常注入',
    'cpuLoad': 'CPU资源耗尽',
    'memoryLoad': '内存资源耗尽'
  }
  return names[type] || type
}

function getGeneTagType(type) {
  const types = {
    'latency': 'info',
    'exception': 'danger',
    'cpuLoad': 'warning',
    'memoryLoad': 'success'
  }
  return types[type] || 'info'
}

function viewYaml(combo) {
  currentYaml.value = generateYamlPreview(combo)
  showYamlDialog.value = true
}

function generateYamlPreview(combo) {
  let yaml = `apiVersion: chaos.platform/v1
kind: ChaosExperiment
metadata:
  name: auto-experiment-${combo.id.toLowerCase()}
  description: Genetic algorithm generated experiment
spec:
  target:
    serviceDiscovery: consul
    serviceName: ${exploreForm.value.serviceName}
    instances: all
  chaosType: combination
  autoRollback: true
  combinationConfig:
`
  for (const gene of getActiveGenes(combo)) {
    yaml += `    - type: ${gene.type}
      intensity: ${gene.intensity?.toFixed(1)}
      duration: ${gene.duration}s
      probability: ${gene.probability?.toFixed(2)}
`
  }
  return yaml
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

onMounted(() => {
  loadServices()
})
</script>

<style lang="scss" scoped>
.smart-exploration {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;

    h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #1a1a2e;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }
  }

  .combination-card {
    background: #f5f6fa;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 24px;
    border-left: 4px solid #dcdfe6;
    transition: all 0.3s;

    &.top-combo {
      background: linear-gradient(135deg, #fef0f0 0%, #fde2e2 100%);
      border-left-color: #f56c6c;
    }

    .combo-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;

      .combo-rank {
        font-size: 20px;
        font-weight: 700;
        color: #1a1a2e;
      }

      .combo-fitness {
        margin-left: auto;
        font-size: 14px;
        color: #666;
        background: #fff;
        padding: 4px 12px;
        border-radius: 4px;
      }
    }

    .combo-genes {
      .gene-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 0;
        border-bottom: 1px solid #e8e8e8;

        &:last-child {
          border-bottom: none;
        }

        .gene-detail {
          font-size: 13px;
          color: #666;
        }
      }
    }
  }

  .report-content {
    max-height: 60vh;
    overflow-y: auto;

    pre {
      background: #1a1a2e;
      color: #a8a8b3;
      padding: 20px;
      border-radius: 8px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
    }
  }

  .yaml-content {
    pre {
      background: #1a1a2e;
      color: #a8a8b3;
      padding: 20px;
      border-radius: 8px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 13px;
      line-height: 1.6;
      max-height: 400px;
      overflow-y: auto;
    }
  }
}
</style>
