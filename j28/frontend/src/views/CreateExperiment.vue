<template>
  <div class="create-experiment">
    <div class="page-card">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="实验名称" prop="name">
              <el-input v-model="form.name" placeholder="请输入实验名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="故障类型" prop="chaosType">
              <el-select v-model="form.chaosType" placeholder="请选择故障类型" style="width: 100%">
                <el-option label="延迟注入" value="latency" />
                <el-option label="Pod杀掉" value="podKill" />
                <el-option label="CPU负载" value="cpuLoad" />
                <el-option label="内存负载" value="memoryLoad" />
                <el-option label="异常注入" value="exception" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="实验描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="请输入实验描述" />
        </el-form-item>

        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="目标服务" prop="targetService">
              <el-select v-model="form.targetService" placeholder="请选择目标服务" style="width: 100%">
                <el-option
                  v-for="service in services"
                  :key="service.serviceName"
                  :label="service.serviceName"
                  :value="service.serviceName"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="持续时间(秒)">
              <el-input-number v-model="form.durationSeconds" :min="10" :max="3600" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="自动回滚">
              <el-switch v-model="form.autoRollback" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="错误率阈值(%)">
              <el-input-number v-model="form.errorRateThreshold" :min="1" :max="100" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="YAML配置" prop="configYaml">
          <div class="yaml-editor-header">
            <span>配置模板:</span>
            <el-radio-group v-model="templateType" @change="loadTemplate">
              <el-radio-button value="latency">延迟注入</el-radio-button>
              <el-radio-button value="podKill">Pod杀掉</el-radio-button>
              <el-radio-button value="cpuLoad">CPU负载</el-radio-button>
              <el-radio-button value="memoryLoad">内存负载</el-radio-button>
            </el-radio-group>
          </div>
          <el-input
            v-model="form.configYaml"
            type="textarea"
            :rows="16"
            placeholder="请输入YAML格式的实验配置"
            class="yaml-editor"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="handleSubmit" :loading="submitting">
            创建实验
          </el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { createExperiment } from '@/api/experiment'
import { getAllServices } from '@/api/service'

const router = useRouter()
const formRef = ref()
const submitting = ref(false)
const templateType = ref('latency')
const services = ref([])

const form = reactive({
  name: '',
  description: '',
  chaosType: 'latency',
  targetService: '',
  durationSeconds: 300,
  autoRollback: true,
  errorRateThreshold: 50,
  configYaml: ''
})

const rules = {
  name: [
    { required: true, message: '请输入实验名称', trigger: 'blur' },
    { max: 128, message: '实验名称不能超过128个字符', trigger: 'blur' }
  ],
  chaosType: [
    { required: true, message: '请选择故障类型', trigger: 'change' }
  ],
  configYaml: [
    { required: true, message: '请输入YAML配置', trigger: 'blur' }
  ]
}

const templates = {
  latency: `apiVersion: chaos.platform/v1
kind: ChaosExperiment
metadata:
  name: order-service-latency
  description: 对订单服务注入延迟
spec:
  target:
    serviceDiscovery: consul
    serviceName: order-service
    instances: all
  
  chaosType: latency
  duration: 300s
  autoRollback: true
  
  latencyConfig:
    latencyMs: 5000
    percentage: 100
  
  rollbackConditions:
    errorRateThreshold: 50
    timeoutSeconds: 600`,

  podKill: `apiVersion: chaos.platform/v1
kind: ChaosExperiment
metadata:
  name: payment-service-pod-kill
  description: 随机杀掉支付服务Pod
spec:
  target:
    serviceDiscovery: consul
    serviceName: payment-service
    instances: random
  
  chaosType: podKill
  duration: 300s
  autoRollback: true
  
  podKillConfig:
    killCount: 1
    intervalSeconds: 60
  
  rollbackConditions:
    errorRateThreshold: 50`,

  cpuLoad: `apiVersion: chaos.platform/v1
kind: ChaosExperiment
metadata:
  name: user-service-cpu-load
  description: 对用户服务注入CPU负载
spec:
  target:
    serviceDiscovery: consul
    serviceName: user-service
    instances: all
  
  chaosType: cpuLoad
  duration: 300s
  autoRollback: true
  
  cpuLoadConfig:
    cpuPercent: 80
    coreCount: 2`,

  memoryLoad: `apiVersion: chaos.platform/v1
kind: ChaosExperiment
metadata:
  name: inventory-service-memory-load
  description: 对库存服务注入内存负载
spec:
  target:
    serviceDiscovery: consul
    serviceName: inventory-service
    instances: all
  
  chaosType: memoryLoad
  duration: 300s
  autoRollback: true
  
  memoryLoadConfig:
    memoryPercent: 70
    durationSeconds: 300`
}

function loadTemplate() {
  form.configYaml = templates[templateType.value]
}

function loadServices() {
  getAllServices().then(res => {
    const uniqueServices = [...new Set(res.map(s => s.serviceName))]
    services.value = uniqueServices.map(name => ({ serviceName: name }))
  })
}

function handleSubmit() {
  formRef.value.validate((valid) => {
    if (valid) {
      submitting.value = true
      createExperiment(form).then(() => {
        ElMessage.success('实验创建成功，等待审批')
        router.push('/experiments')
      }).finally(() => {
        submitting.value = false
      })
    }
  })
}

function handleReset() {
  formRef.value.resetFields()
  loadTemplate()
}

onMounted(() => {
  loadTemplate()
  loadServices()
})
</script>

<style lang="scss" scoped>
.create-experiment {
  .yaml-editor-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 12px;
    font-size: 14px;
    color: #666;
  }

  .yaml-editor {
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 13px;
    line-height: 1.5;
  }
}
</style>
