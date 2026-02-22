<template>
  <div class="page-container">
    <div class="page-header">
      <h2>系统概览</h2>
      <div class="page-actions">
        <el-button @click="refreshStats" :loading="loading" type="primary">
          <el-icon><Refresh /></el-icon>
          刷新数据
        </el-button>
        <el-switch 
          v-model="autoRefresh"
          active-text="自动刷新"
          @change="toggleAutoRefresh"
        />
      </div>
    </div>

    <!-- AI欢迎语 -->    <div class="welcome-section" v-if="welcomeMessage || welcomeLoading">      <div class="welcome-card">        <div class="welcome-icon">          <el-icon size="24">            <ChatLineRound />          </el-icon>        </div>                <!-- 加载状态 -->        <div v-if="welcomeLoading" class="welcome-content loading">          <div class="welcome-skeleton">            <div class="skeleton-line long"></div>            <div class="skeleton-line medium"></div>            <div class="skeleton-line short"></div>          </div>          <div class="welcome-info">            <span class="loading-text">              <el-icon class="loading-icon"><Loading /></el-icon>              AI正在生成欢迎语...            </span>          </div>        </div>                <!-- 实际内容 -->        <div v-else class="welcome-content">          <div class="welcome-text">{{ welcomeMessage }}</div>          <div class="welcome-info">            <span class="model-info">来自模型: {{ welcomeModel?.display_name }}</span>            <el-button               size="small"               type="text"               @click="refreshWelcome"              :loading="welcomeLoading"              title="刷新欢迎语"            >              <el-icon><Refresh /></el-icon>            </el-button>          </div>        </div>      </div>    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card" v-for="stat in statsCards" :key="stat.key">
        <div class="stat-icon" :style="{ backgroundColor: stat.color }">
          <el-icon>
            <component :is="stat.icon" />
          </el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-title">{{ stat.title }}</div>
          <div class="stat-value">{{ stat.value || 0 }}</div>
          <div class="stat-change" :class="stat.changeType">
            <el-icon><component :is="stat.trendIcon" /></el-icon>
            {{ stat.change }}
          </div>
        </div>
        <div class="stat-progress">
          <el-progress 
            v-if="stat.progress !== undefined"
            :percentage="stat.progress" 
            :show-text="false" 
            :stroke-width="3"
            :color="stat.color"
          />
        </div>
      </div>
    </div>

    <!-- 图表区域 -->
    <div class="charts-grid">
      <!-- 用户增长趋势 -->
      <div class="chart-card">
        <div class="chart-header">
          <h3>用户增长趋势</h3>
          <el-select v-model="userChartPeriod" @change="loadUserTrend" style="width: 120px;">
            <el-option label="7天" value="7d" />
            <el-option label="30天" value="30d" />
            <el-option label="90天" value="90d" />
          </el-select>
        </div>
        <div class="chart-content" ref="userTrendChart" style="height: 300px;"></div>
      </div>

      <!-- 模型使用统计 -->
      <div class="chart-card">
        <div class="chart-header">
          <h3>模型使用分布</h3>
          <el-button size="small" @click="loadModelUsage">
            <el-icon><Refresh /></el-icon>
          </el-button>
        </div>
        <div class="chart-content" ref="modelUsageChart" style="height: 300px;"></div>
      </div>

      <!-- 会话活跃度 -->
      <div class="chart-card">
        <div class="chart-header">
          <h3>会话活跃度</h3>
          <el-select v-model="conversationPeriod" @change="loadConversationTrend" style="width: 120px;">
            <el-option label="24小时" value="24h" />
            <el-option label="7天" value="7d" />
            <el-option label="30天" value="30d" />
          </el-select>
        </div>
        <div class="chart-content" ref="conversationChart" style="height: 300px;"></div>
      </div>

      <!-- 系统状态 -->
      <div class="chart-card system-status-card">
        <div class="chart-header">
          <h3>系统状态监控</h3>
          <div class="status-indicator">
            <el-tag
              :type="systemStatus.status === 'healthy' ? 'success' : 'danger'"
              size="large"
              effect="dark"
            >
              <el-icon style="margin-right: 4px;">
                <component :is="systemStatus.status === 'healthy' ? 'CircleCheckFilled' : 'CircleCloseFilled'" />
              </el-icon>
              {{ systemStatus.status === 'healthy' ? '系统正常' : '系统异常' }}
            </el-tag>
          </div>
        </div>
        <div class="system-status">
          <!-- 服务状态 -->
          <div class="status-section">
            <h4 class="section-title">服务状态</h4>
            <div class="status-grid">
              <div class="status-card">
                <div class="status-card-header">
                  <el-icon size="20" :color="systemStatus.database ? '#67c23a' : '#f56c6c'">
                    <component :is="systemStatus.database ? 'SuccessFilled' : 'CircleCloseFilled'" />
                  </el-icon>
                  <span>数据库</span>
                </div>
                <div class="status-card-content">
                  <span :class="systemStatus.database ? 'status-success' : 'status-error'">
                    {{ systemStatus.database ? '连接正常' : '连接异常' }}
                  </span>
                </div>
              </div>
              <div class="status-card">
                <div class="status-card-header">
                  <el-icon size="20" :color="systemStatus.redis ? '#67c23a' : '#f56c6c'">
                    <component :is="systemStatus.redis ? 'SuccessFilled' : 'CircleCloseFilled'" />
                  </el-icon>
                  <span>Redis</span>
                </div>
                <div class="status-card-content">
                  <span :class="systemStatus.redis ? 'status-success' : 'status-error'">
                    {{ systemStatus.redis ? '连接正常' : '连接异常' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <!-- 资源使用 -->
          <div class="status-section">
            <h4 class="section-title">资源使用</h4>
            <div class="resource-grid">
              <div class="resource-item">
                <div class="resource-header">
                  <span class="resource-label">CPU使用率</span>
                  <span class="resource-value">{{ systemStatus.cpu }}%</span>
                </div>
                <el-progress
                  :percentage="systemStatus.cpu"
                  :color="getProgressColor(systemStatus.cpu)"
                  :stroke-width="8"
                  :show-text="false"
                />
              </div>
              <div class="resource-item">
                <div class="resource-header">
                  <span class="resource-label">内存使用</span>
                  <span class="resource-value">{{ systemStatus.memory }}%</span>
                </div>
                <el-progress
                  :percentage="systemStatus.memory"
                  :color="getProgressColor(systemStatus.memory)"
                  :stroke-width="8"
                  :show-text="false"
                />
              </div>
              <div class="resource-item">
                <div class="resource-header">
                  <span class="resource-label">存储空间</span>
                  <span class="resource-value">{{ systemStatus.storage }}%</span>
                </div>
                <el-progress
                  :percentage="systemStatus.storage"
                  :color="getProgressColor(systemStatus.storage)"
                  :stroke-width="8"
                  :show-text="false"
                />
              </div>
            </div>
          </div>
          <!-- 系统信息 -->
          <div class="status-section">
            <h4 class="section-title">系统信息</h4>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">运行时间</span>
                <span class="info-value">{{ formatUptime(systemStatus.uptime) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">最后更新</span>
                <span class="info-value">{{ formatTime(systemStatus.timestamp) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import api from '@/utils/api'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'

const router = useRouter()
const authStore = useAuthStore()

// 响应式数据
const stats = ref({})
const loading = ref(false)
const autoRefresh = ref(false)
const refreshTimer = ref(null)
const userChartPeriod = ref('7d')
const conversationPeriod = ref('24h')

// 欢迎语相关
const welcomeMessage = ref('')
const welcomeModel = ref(null)
const welcomeLoading = ref(false)

// 图表实例
const userTrendChart = ref()
const modelUsageChart = ref()
const conversationChart = ref()
let userChart = null
let modelChart = null
let conversationChartInstance = null

// 系统状态
const systemStatus = ref({
  status: 'healthy',
  database: true,
  redis: true,
  storage: 45,
  memory: 62,
  cpu: 23,
  uptime: 0,
  timestamp: new Date().toISOString()
})

// 计算属性
const statsCards = computed(() => [
  {
    key: 'users',
    title: '总用户数',
    value: stats.value.users?.total_users,
    change: `今日新增 ${stats.value.users?.today_new_users || 0}`,
    changeType: 'positive',
    trendIcon: 'CaretTop',
    icon: 'User',
    color: '#409EFF',
    progress: stats.value.users?.total_users ? Math.min((stats.value.users.active_users / stats.value.users.total_users) * 100, 100) : 0
  },
  {
    key: 'active_users',
    title: '活跃用户',
    value: stats.value.users?.active_users,
    change: `占比 ${stats.value.users?.total_users ? Math.round((stats.value.users.active_users / stats.value.users.total_users) * 100) : 0}%`,
    changeType: 'positive',
    trendIcon: 'CaretTop',
    icon: 'UserFilled',
    color: '#67C23A'
  },
  {
    key: 'models',
    title: 'AI模型数',
    value: stats.value.models?.total_models,
    change: `启用 ${stats.value.models?.active_models || 0}`,
    changeType: 'positive',
    trendIcon: 'CaretTop',
    icon: 'Cpu',
    color: '#E6A23C',
    progress: stats.value.models?.total_models ? Math.min((stats.value.models.active_models / stats.value.models.total_models) * 100, 100) : 0
  },
  {
    key: 'conversations',
    title: '总会话数',
    value: stats.value.conversations?.total_conversations,
    change: `今日 ${stats.value.conversations?.today_conversations || 0}`,
    changeType: 'positive',
    trendIcon: 'CaretTop',
    icon: 'ChatLineSquare',
    color: '#F56C6C'
  }
])

// 方法
const loadStats = async () => {
  loading.value = true
  try {
    const response = await api.get('/admin/stats')
    if (response.success) {
      stats.value = response.data
    }
  } catch (error) {
    console.error('加载统计数据失败:', error)
    ElMessage.error('加载统计数据失败')
  } finally {
    loading.value = false
  }
}

const loadSystemStatus = async () => {
  try {
    const response = await api.get('/admin/system-status')
    if (response.success) {
      systemStatus.value = response.data
    }
  } catch (error) {
    console.error('加载系统状态失败:', error)
  }
}

const loadUserTrend = async () => {
  try {
    const response = await api.get(`/admin/stats/user-trend?period=${userChartPeriod.value}`)
    if (response.success && userChart) {
      const data = response.data
      userChart.setOption({
        xAxis: { data: data.dates },
        series: [{
          name: '新增用户',
          data: data.newUsers
        }, {
          name: '累计用户',
          data: data.totalUsers
        }]
      })
    }
  } catch (error) {
    console.error('加载用户趋势失败:', error)
  }
}

const loadModelUsage = async () => {
  try {
    const response = await api.get('/admin/stats/model-usage')
    if (response.success && modelChart) {
      const data = response.data
      modelChart.setOption({
        series: [{
          data: data.map(item => ({ name: item.model_name, value: item.usage_count }))
        }]
      })
    }
  } catch (error) {
    console.error('加载模型使用统计失败:', error)
  }
}

const loadConversationTrend = async () => {
  try {
    const response = await api.get(`/admin/stats/conversation-trend?period=${conversationPeriod.value}`)
    if (response.success && conversationChartInstance) {
      const data = response.data
      conversationChartInstance.setOption({
        xAxis: { data: data.times },
        series: [{
          data: data.counts
        }]
      })
    }
  } catch (error) {
    console.error('加载会话趋势失败:', error)
  }
}

const initCharts = async () => {
  await nextTick()
  
  // 用户趋势图
  if (userTrendChart.value) {
    userChart = echarts.init(userTrendChart.value)
    userChart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['新增用户', '累计用户'] },
      xAxis: { type: 'category', data: [] },
      yAxis: { type: 'value' },
      series: [{
        name: '新增用户',
        type: 'line',
        data: [],
        smooth: true,
        itemStyle: { color: '#409EFF' }
      }, {
        name: '累计用户',
        type: 'line',
        data: [],
        smooth: true,
        itemStyle: { color: '#67C23A' }
      }]
    })
  }

  // 模型使用饼图
  if (modelUsageChart.value) {
    modelChart = echarts.init(modelUsageChart.value)
    modelChart.setOption({
      tooltip: { trigger: 'item' },
      series: [{
        type: 'pie',
        radius: '60%',
        data: [],
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }]
    })
  }

  // 会话活跃度图
  if (conversationChart.value) {
    conversationChartInstance = echarts.init(conversationChart.value)
    conversationChartInstance.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: [] },
      yAxis: { type: 'value' },
      series: [{
        type: 'bar',
        data: [],
        itemStyle: { color: '#E6A23C' }
      }]
    })
  }

  // 加载图表数据
  loadUserTrend()
  loadModelUsage()
  loadConversationTrend()
}

const refreshStats = async () => {
  await loadStats()
  await loadSystemStatus()
  await loadUserTrend()
  await loadModelUsage()
  await loadConversationTrend()
}

const toggleAutoRefresh = (enabled) => {
  if (enabled) {
    refreshTimer.value = setInterval(refreshStats, 30000) // 30秒刷新一次
    ElMessage.success('已开启自动刷新')
  } else {
    if (refreshTimer.value) {
      clearInterval(refreshTimer.value)
      refreshTimer.value = null
    }
    ElMessage.info('已关闭自动刷新')
  }
}

const getProgressColor = (percentage) => {
  if (percentage >= 80) return '#f56c6c'
  if (percentage >= 60) return '#e6a23c'
  return '#67c23a'
}

const formatUptime = (seconds) => {
  if (!seconds) return '0秒'
  
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (days > 0) return `${days}天${hours}小时`
  if (hours > 0) return `${hours}小时${minutes}分钟`
  return `${minutes}分钟`
}

const formatTime = (timeString) => {
  if (!timeString) return ''
  const time = new Date(timeString)
  const now = new Date()
  const diff = now.getTime() - time.getTime()
  
  if (diff < 60 * 1000) return '刚刚'
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}分钟前`
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}小时前`
  return time.toLocaleDateString('zh-CN')
}

// 欢迎语相关方法
const loadWelcomeMessage = async () => {
  try {
    welcomeLoading.value = true
    // 获取随机免费模型
    const modelsResponse = await api.get('/admin/models')
    if (!modelsResponse.success) return
    const freeModels = modelsResponse.data.filter(model => model.is_free && model.is_active)
    if (freeModels.length === 0) return
    // 随机选择一个免费模型
    const randomModel = freeModels[Math.floor(Math.random() * freeModels.length)]
    welcomeModel.value = randomModel
    // 调用模型获取欢迎语
    const welcomeResponse = await api.post(`/admin/models/${randomModel.id}/test`, {
      message: '请生成一句简短的系统管理欢迎语，体现专业、友好的管理者风格。回复里不需要有对欢迎语的解析'
    })
    if (welcomeResponse.success && welcomeResponse.data.response) {
      welcomeMessage.value = welcomeResponse.data.response
    } else {
      // 如果API调用失败，使用默认欢迎语
      welcomeMessage.value = getDefaultWelcomeMessage()
    }
  } catch (error) {
    console.error('获取欢迎语失败:', error)
    welcomeMessage.value = getDefaultWelcomeMessage()
  } finally {
    welcomeLoading.value = false
  }
}

const getDefaultWelcomeMessage = () => {
  const messages = [
    '欢迎回来！系统运行正常，一切数据尽在掌握中。',
    '您好，管理员！今天又是充满挑战与成就的一天。',
    '系统状态良好，用户活跃度持续上升，让我们继续优化体验！',
    '欢迎使用AI Park管理系统，智能化管理让工作更高效。',
    '数据洞察未来，智慧驱动成长，欢迎来到管理中心。'
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

const refreshWelcome = () => {
  loadWelcomeMessage()
}

// 生命周期
onMounted(async () => {
  await loadStats()
  await loadSystemStatus()
  await initCharts()
  await loadWelcomeMessage()
})

onBeforeUnmount(() => {
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value)
  }
  if (userChart) userChart.dispose()
  if (modelChart) modelChart.dispose()
  if (conversationChartInstance) conversationChartInstance.dispose()
})
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-actions {
  display: flex;
  align-items: center;
  gap: 15px;
}

.welcome-section {
  margin-bottom: 24px;
}

.welcome-card {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.05), rgba(118, 75, 162, 0.05));
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 20px 24px;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.welcome-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.15);
}

.welcome-icon {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
}

.welcome-content {
  flex: 1;
}

.welcome-content.loading {
  opacity: 0.8;
}

.welcome-text {
  font-size: 16px;
  color: #2c3e50;
  line-height: 1.6;
  margin-bottom: 8px;
  font-weight: 500;
}

.welcome-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.model-info {
  font-size: 12px;
  color: #6b7280;
  background: rgba(255, 255, 255, 0.6);
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.welcome-skeleton {
  margin-bottom: 12px;
}

.skeleton-line {
  height: 16px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 8px;
  margin-bottom: 8px;
}

.skeleton-line.long {
  width: 90%;
}

.skeleton-line.medium {
  width: 70%;
}

.skeleton-line.short {
  width: 50%;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.loading-text {
  font-size: 12px;
  color: #667eea;
  background: rgba(102, 126, 234, 0.1);
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid rgba(102, 126, 234, 0.2);
  display: flex;
  align-items: center;
  gap: 6px;
}

.loading-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  transition: all 0.3s;
  cursor: pointer;
  position: relative;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 24px;
  margin-right: 20px;
  flex-shrink: 0;
}

.stat-content {
  flex: 1;
}

.stat-title {
  font-size: 14px;
  color: #909399;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 8px;
}

.stat-change {
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.stat-change.positive {
  color: #67c23a;
}

.stat-change.negative {
  color: #f56c6c;
}

.stat-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.chart-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.chart-header {
  padding: 20px 20px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chart-content {  padding: 0 20px 20px;}.system-status-card {  height: auto;  min-height: 400px;}.status-indicator {  display: flex;  align-items: center;}.system-status {  padding: 20px;}.status-section {  margin-bottom: 24px;}.status-section:last-child {  margin-bottom: 0;}.section-title {  font-size: 16px;  font-weight: 600;  color: #303133;  margin: 0 0 16px 0;  padding-bottom: 8px;  border-bottom: 2px solid #f0f2f5;}.status-grid {  display: grid;  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));  gap: 16px;}.status-card {  background: #f8f9fa;  border: 1px solid #e4e7ed;  border-radius: 8px;  padding: 16px;  transition: all 0.3s;}.status-card:hover {  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);  transform: translateY(-2px);}.status-card-header {  display: flex;  align-items: center;  gap: 8px;  margin-bottom: 8px;  font-weight: 600;  color: #303133;}.status-card-content {  font-size: 14px;}.status-success {  color: #67c23a;  font-weight: 500;}.status-error {  color: #f56c6c;  font-weight: 500;}.resource-grid {  display: flex;  flex-direction: column;  gap: 16px;}.resource-item {  background: #f8f9fa;  border: 1px solid #e4e7ed;  border-radius: 8px;  padding: 16px;}.resource-header {  display: flex;  justify-content: space-between;  align-items: center;  margin-bottom: 12px;}.resource-label {  font-size: 14px;  color: #606266;  font-weight: 500;}.resource-value {  font-size: 16px;  font-weight: 600;  color: #303133;}.info-grid {  display: grid;  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));  gap: 16px;}.info-item {  background: #f8f9fa;  border: 1px solid #e4e7ed;  border-radius: 8px;  padding: 16px;  display: flex;  justify-content: space-between;  align-items: center;}.info-label {  font-size: 14px;  color: #606266;  font-weight: 500;}.info-value {  font-size: 14px;  color: #303133;  font-weight: 600;}

.card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.card-header {
  padding: 20px 20px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h3 {
  margin: 0;
  font-size: 18px;
  color: #303133;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .charts-grid {
    grid-template-columns: 1fr;
  }
  
  .actions-grid {
    grid-template-columns: 1fr;
  }
}
</style> 