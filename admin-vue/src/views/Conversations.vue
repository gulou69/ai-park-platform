<template>
  <div class="page-container">
    <div class="page-header">
      <h2>会话管理</h2>
    </div>

    <!-- 工具栏 -->
    <div class="table-toolbar">
      <div class="toolbar-left">
        <el-input
          v-model="searchForm.userPhone"
          placeholder="搜索用户手机号"
          style="width: 150px; margin-right: 10px;"
          prefix-icon="Search"
          clearable
        />
        <el-select
          v-model="searchForm.modelId"
          placeholder="选择模型"
          style="width: 120px; margin-right: 10px;"
          clearable
        >
          <el-option
            v-for="model in models"
            :key="model.id"
            :label="model.display_name"
            :value="model.id"
          />
        </el-select>
        <el-date-picker
          v-model="searchForm.dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 240px; margin-right: 10px;"
          @change="handleSearch"
        />
        <el-button @click="handleSearch">
          <el-icon><Search /></el-icon>
          搜索
        </el-button>
        <el-button @click="resetSearch">
          <el-icon><RefreshLeft /></el-icon>
          重置
        </el-button>
      </div>
      <div class="toolbar-right">
        <el-button 
          v-if="selectedConversations.length > 0"
          type="danger" 
          @click="batchDeleteConversations"
        >
          <el-icon><Delete /></el-icon>
          批量删除 ({{ selectedConversations.length }})
        </el-button>
        <el-button @click="loadConversations" :loading="loading">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="data-table">
      <el-table 
        :data="conversations" 
        v-loading="loading" 
        stripe
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="id" label="会话ID" width="100" />
        <el-table-column prop="title" label="标题" min-width="200">
          <template #default="{ row }">
            <el-text :title="row.title" truncated>
              {{ row.title || '未命名会话' }}
            </el-text>
          </template>
        </el-table-column>
        <el-table-column prop="user_phone" label="用户" width="120" />
        <el-table-column prop="model_name" label="模型" width="120">
          <template #default="{ row }">
            <el-tag size="small">{{ row.model_name || '未知模型' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="消息数" width="80">
          <template #default="{ row }">
            <span>{{ row.message_count || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="160">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column prop="updated_at" label="更新时间" width="160">
          <template #default="{ row }">
            {{ formatTime(row.updated_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <div class="primary-actions">
                <el-button size="small" @click="viewConversation(row)" title="查看会话">
                  <el-icon><View /></el-icon>
                  <span class="button-text">查看</span>
                </el-button>
                <el-button type="danger" size="small" @click="deleteConversation(row)" title="删除会话">
                  <el-icon><Delete /></el-icon>
                  <span class="button-text">删除</span>
                </el-button>
              </div>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="table-pagination">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="loadConversations"
          @size-change="loadConversations"
        />
      </div>
    </div>

    <!-- 会话详情对话框 -->
    <el-dialog
      v-model="showConversationDetail"
      title="会话详情"
      width="800px"
      max-height="600px"
    >
      <div v-if="currentConversation" class="conversation-detail">
        <div class="conversation-info">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="会话ID">{{ currentConversation.id }}</el-descriptions-item>
            <el-descriptions-item label="标题">{{ currentConversation.title || '未命名会话' }}</el-descriptions-item>
            <el-descriptions-item label="用户">{{ currentConversation.user_phone }}</el-descriptions-item>
            <el-descriptions-item label="模型">{{ currentConversation.model_name }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatTime(currentConversation.created_at) }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ formatTime(currentConversation.updated_at) }}</el-descriptions-item>
          </el-descriptions>
        </div>
        
        <div class="conversation-messages" v-if="conversationMessages.length > 0">
          <h4>会话消息 ({{ conversationMessages.length }}条)</h4>
          <div class="messages-list">
            <div 
              v-for="message in conversationMessages" 
              :key="message.id"
              class="message-item"
              :class="{ 'user-message': message.role === 'user', 'assistant-message': message.role === 'assistant' }"
            >
              <div class="message-role">
                <el-tag :type="message.role === 'user' ? 'primary' : 'success'">
                  {{ message.role === 'user' ? '用户' : 'AI助手' }}
                </el-tag>
                <span class="message-time">{{ formatTime(message.created_at) }}</span>
              </div>
              <div class="message-content">{{ message.content }}</div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showConversationDetail = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '@/utils/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const loading = ref(false)
const conversations = ref([])
const models = ref([])
const selectedConversations = ref([])
const showConversationDetail = ref(false)
const currentConversation = ref(null)
const conversationMessages = ref([])

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

const searchForm = reactive({
  userPhone: '',
  modelId: '',
  dateRange: []
})

// 加载模型列表
const loadModels = async () => {
  try {
    const response = await api.get('/admin/models')
    if (response.success) {
      models.value = response.data
    }
  } catch (error) {
    console.error('加载模型列表失败:', error)
  }
}

const loadConversations = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      userPhone: searchForm.userPhone || undefined,
      modelId: searchForm.modelId || undefined,
      startDate: searchForm.dateRange?.[0] || undefined,
      endDate: searchForm.dateRange?.[1] || undefined
    }
    
    const response = await api.get('/admin/conversations', { params })
    if (response.success) {
      conversations.value = response.data.conversations
      pagination.total = response.data.pagination.total
    }
  } catch (error) {
    console.error('加载会话列表失败:', error)
    ElMessage.error('加载会话列表失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.page = 1
  loadConversations()
}

const resetSearch = () => {
  Object.assign(searchForm, {
    userPhone: '',
    modelId: '',
    dateRange: []
  })
  pagination.page = 1
  loadConversations()
}

const handleSelectionChange = (selection) => {
  selectedConversations.value = selection
}

const viewConversation = async (conversation) => {
  currentConversation.value = conversation
  showConversationDetail.value = true
  
  // 加载会话消息
  try {
    const response = await api.get(`/admin/conversations/${conversation.id}/messages`)
    if (response.success) {
      conversationMessages.value = response.data
    }
  } catch (error) {
    console.error('加载会话消息失败:', error)
    ElMessage.error('加载会话消息失败')
    conversationMessages.value = []
  }
}

const deleteConversation = async (conversation) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除会话 "${conversation.title || '未命名会话'}" 吗？`,
      '确认删除',
      { type: 'warning' }
    )
    
    await api.delete(`/admin/conversations/${conversation.id}`)
    ElMessage.success('会话删除成功')
    await loadConversations()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除会话失败:', error)
      ElMessage.error('删除会话失败')
    }
  }
}

const batchDeleteConversations = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedConversations.value.length} 个会话吗？`,
      '确认批量删除',
      { type: 'warning' }
    )
    
    const ids = selectedConversations.value.map(c => c.id)
    await api.post('/admin/conversations/batch-delete', { ids })
    ElMessage.success('批量删除成功')
    selectedConversations.value = []
    await loadConversations()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('批量删除失败:', error)
      ElMessage.error('批量删除失败')
    }
  }
}

const formatTime = (timeString) => {
  if (!timeString) return ''
  return new Date(timeString).toLocaleString('zh-CN')
}

onMounted(() => {
  loadModels()
  loadConversations()
})
</script>

<style scoped>
.conversation-detail {
  max-height: 500px;
  overflow-y: auto;
}

.conversation-info {
  margin-bottom: 20px;
}

.messages-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 10px;
}

.message-item {
  margin-bottom: 15px;
  padding: 10px;
  border-radius: 8px;
  background-color: #f8f9fa;
}

.user-message {
  background-color: #e3f2fd;
}

.assistant-message {
  background-color: #f1f8e9;
}

.message-role {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.message-time {
  font-size: 12px;
  color: #909399;
}

.message-content {
  line-height: 1.5;
  white-space: pre-wrap;
}
</style> 