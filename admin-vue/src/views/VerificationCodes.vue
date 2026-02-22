<template>
  <div class="verification-codes-page">
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">验证码管理</h1>
        <p class="page-subtitle">管理用户申请的验证码记录</p>
      </div>
      <div class="header-actions">
        <el-button 
          type="warning" 
          :icon="Delete" 
          @click="clearExpiredCodes"
          :loading="clearingExpired"
        >
          清理过期
        </el-button>
        <el-button 
          type="primary" 
          :icon="Refresh" 
          @click="loadData"
          :loading="loading"
        >
          刷新
        </el-button>
      </div>
    </div>



    <!-- 搜索和筛选 -->
    <div class="search-filters">
      <div class="filter-row">
        <div class="search-input">
          <el-input
            v-model="filters.phone"
            placeholder="搜索手机号"
            clearable
            :prefix-icon="Search"
            @keyup.enter="loadCodes"
            @clear="loadCodes"
          />
        </div>
        
        <div class="filter-select">
          <el-select
            v-model="filters.type"
            placeholder="验证码类型"
            clearable
            @change="loadCodes"
          >
            <el-option label="注册" :value="1" />
            <el-option label="登录" :value="2" />
            <el-option label="重置密码" :value="3" />
          </el-select>
        </div>
        

        
        <el-button type="primary" :icon="Search" @click="loadCodes">
          搜索
        </el-button>
        <el-button @click="resetFilters">
          重置
        </el-button>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="data-table">
      <el-table :data="codes" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="phone" label="手机号" width="130" />
        <el-table-column prop="code" label="验证码" width="100">
          <template #default="{ row }">
            <span class="code-text">{{ row.code }}</span>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag 
              :type="getTypeTagType(row.type)"
              size="small"
            >
              {{ row.type_text }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag 
              :type="getStatusTagType(row.status)"
              size="small"
            >
              {{ row.status_text }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="申请时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="剩余时间" width="120">
          <template #default="{ row }">
            <span 
              :class="['time-remaining', {
                'expiring': row.expires_in <= 60
              }]"
            >
              {{ getTimeRemaining(row.expires_in) }}
            </span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 分页 -->
    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Search, 
  Refresh, 
  Delete
} from '@element-plus/icons-vue'
import api from '@/utils/api'

// 响应式数据
const loading = ref(false)
const clearingExpired = ref(false)
const codes = ref([])

const filters = reactive({
  phone: '',
  type: undefined
})

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

// 计算属性
const formatTime = (timeString) => {
  if (!timeString) return '无'
  return new Date(timeString).toLocaleString('zh-CN')
}

const getTimeRemaining = (expiresIn) => {
  if (expiresIn <= 0) {
    return '已过期'
  }
  
  const minutes = Math.floor(expiresIn / 60)
  const seconds = expiresIn % 60
  
  if (minutes > 0) {
    return `${minutes}分钟${seconds}秒`
  } else {
    return `${seconds}秒`
  }
}

const getTypeTagType = (type) => {
  switch (type) {
    case 1: return 'success'  // 注册
    case 2: return 'info'     // 登录  
    case 3: return 'warning'  // 重置密码
    default: return ''
  }
}

const getStatusTagType = (status) => {
  switch (status) {
    case 'pending': return 'warning'
    case 'used': return 'success'
    case 'expired': return 'danger'
    default: return ''
  }
}

// 方法
const loadData = async () => {
  await loadCodes()
}

const loadCodes = async () => {
  try {
    loading.value = true
    
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      ...filters
    }
    

    
    const response = await api.get('/admin/verification-codes', { params })
    
    if (response.success) {
      codes.value = response.data.codes
      pagination.total = response.data.pagination.total
    }
  } catch (error) {
    console.error('获取验证码列表失败:', error)
    ElMessage.error('获取验证码列表失败')
  } finally {
    loading.value = false
  }
}



const clearExpiredCodes = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清理所有过期的验证码吗？',
      '确认操作',
      {
        type: 'warning'
      }
    )
    
    clearingExpired.value = true
    const response = await api.post('/admin/verification-codes/clear-expired')
    
    if (response.success) {
      ElMessage.success(response.message || '清理完成')
      await loadCodes()
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('清理过期验证码失败:', error)
      ElMessage.error('清理过期验证码失败')
    }
  } finally {
    clearingExpired.value = false
  }
}

const resetFilters = () => {
  filters.phone = ''
  filters.type = undefined
  pagination.page = 1
  loadCodes()
}

const handleSizeChange = (size) => {
  pagination.pageSize = size
  pagination.page = 1
  loadCodes()
}

const handleCurrentChange = (page) => {
  pagination.page = page
  loadCodes()
}

// 生命周期
onMounted(() => {
  loadData()
})
</script>

<style scoped>
.verification-codes-page {
  padding: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.header-content h1 {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
  color: #1f2937;
}

.header-content p {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
}

.header-actions {
  display: flex;
  gap: 12px;
}


.search-filters {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
}

.filter-row {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}

.search-input {
  min-width: 200px;
}

.filter-select {
  min-width: 120px;
}

.filter-date {
  min-width: 300px;
}

.data-table {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
  margin-bottom: 16px;
}

.code-text {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-weight: 600;
  color: #1f2937;
  background: rgba(79, 70, 229, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}

.time-remaining {
  font-weight: 500;
}



.time-remaining.expiring {
  color: #f59e0b;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}

@media (max-width: 768px) {
  .verification-codes-page {
    padding: 16px;
  }
  
  .page-header {
    flex-direction: column;
    gap: 16px;
  }
  
  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }
  

  
  .filter-row {
    flex-direction: column;
    align-items: stretch;
  }
  
  .filter-row > * {
    width: 100%;
  }
}
</style> 