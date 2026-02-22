<template>
  <div class="page-container">
    <div class="page-header">
      <h2>模型管理</h2>
    </div>

    <!-- 工具栏 -->
    <div class="table-toolbar">
      <div class="toolbar-left">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索模型名称"
          style="width: 200px; margin-right: 10px;"
          prefix-icon="Search"
          clearable
        />
        <el-select
          v-model="filterProvider"
          placeholder="提供商"
          style="width: 120px; margin-right: 10px;"
          clearable
        >
          <el-option
            v-for="provider in providers"
            :key="provider"
            :label="provider"
            :value="provider"
          />
        </el-select>
        <el-select
          v-model="filterStatus"
          placeholder="状态"
          style="width: 100px; margin-right: 10px;"
          clearable
        >
          <el-option label="启用" value="active" />
          <el-option label="禁用" value="inactive" />
        </el-select>
        <el-select
          v-model="filterType"
          placeholder="类型"
          style="width: 100px; margin-right: 10px;"
          clearable
        >
          <el-option label="文本" value="text" />
          <el-option label="图像" value="image" />
        </el-select>
      </div>
      <div class="toolbar-right">
        <el-button
          v-if="selectedModels.length > 0"
          type="warning"
          @click="batchToggleStatus"
        >
          <el-icon><Switch /></el-icon>
          批量切换状态 ({{ selectedModels.length }})
        </el-button>
        <el-button type="primary" @click="openModelDialog()">
          <el-icon><Plus /></el-icon>
          添加模型
        </el-button>
        <el-button @click="loadModels" :loading="loading">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="data-table">
      <el-table 
        :data="filteredModels" 
        v-loading="loading" 
        stripe
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="id" label="ID" width="80" sortable />
        <el-table-column prop="display_name" label="显示名称" min-width="120" sortable />
        <el-table-column prop="name" label="模型名称" min-width="120" />
        <el-table-column prop="provider" label="提供商" width="100" sortable />
        <el-table-column label="类型" width="80">
          <template #default="{ row }">
            <el-tag :type="row.model_type === 'text' ? 'primary' : 'success'">
              {{ row.model_type === 'text' ? '文本' : '图像' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="免费" width="80">
          <template #default="{ row }">
            <el-tag :type="row.is_free ? 'success' : 'warning'">
              {{ row.is_free ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'danger'">
              {{ row.is_active ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="160" sortable>
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
                <el-table-column label="操作" width="160" fixed="right">          <template #default="{ row }">            <div class="table-actions two-row-actions">              <div class="action-row">                <el-button                   size="small"                   @click="testModel(row)"                   :loading="row.testing"                  class="action-primary"                  title="测试模型"                >                  <el-icon><Lightning /></el-icon>                  <span class="button-text">测试</span>                </el-button>                <el-button                   size="small"                   @click="openModelDialog(row)"                  title="编辑模型"                >                  <el-icon><Edit /></el-icon>                  <span class="button-text">编辑</span>                </el-button>              </div>              <div class="action-row">                <el-button                   :type="row.is_active ? 'warning' : 'success'"                   size="small"                   @click="toggleModelStatus(row)"                  title="切换状态"                >                  <el-icon><Switch /></el-icon>                  <span class="button-text">{{ row.is_active ? '禁用' : '启用' }}</span>                </el-button>                <el-button                   type="danger"                   size="small"                   @click="deleteModel(row)"                  title="删除模型"                >                  <el-icon><Delete /></el-icon>                  <span class="button-text">删除</span>                </el-button>              </div>            </div>          </template>        </el-table-column>
      </el-table>
    </div>

    <!-- 模型编辑对话框 -->
    <el-dialog
      v-model="showModelDialog"
      :title="editingModel ? '编辑模型' : '添加模型'"
      width="700px"
    >
      <el-form :model="modelForm" :rules="modelRules" ref="modelFormRef" label-width="100px" class="dialog-form">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="模型名称" prop="name">
              <el-input v-model="modelForm.name" placeholder="如: gpt-4" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="显示名称" prop="display_name">
              <el-input v-model="modelForm.display_name" placeholder="如: GPT-4" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-form-item label="描述">
          <el-input v-model="modelForm.description" type="textarea" rows="2" />
        </el-form-item>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="类型" prop="model_type">
              <el-select v-model="modelForm.model_type" style="width: 100%;">
                <el-option label="文本模型" value="text" />
                <el-option label="图像模型" value="image" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="提供商" prop="provider">
              <el-select v-model="modelForm.provider" style="width: 100%;" allow-create filterable>
                <el-option label="Dify" value="dify" />
                <el-option label="OpenAI" value="openai" />
                <el-option label="Azure" value="azure" />
                <el-option label="Claude" value="claude" />
                <el-option label="其他" value="other" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-form-item label="API地址" prop="api_url">
          <el-input v-model="modelForm.api_url" placeholder="https://api.example.com/v1/chat/completions" />
        </el-form-item>
        
        <el-form-item label="API密钥" prop="api_key">
          <el-input 
            v-model="modelForm.api_key" 
            placeholder="API密钥" 
            type="password" 
            show-password
          />
        </el-form-item>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="图标路径">
              <el-input v-model="modelForm.icon_path" placeholder="/assets/icons/model.png" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="排序">
              <el-input-number v-model="modelForm.sort_order" :min="0" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="是否免费">
              <el-switch v-model="modelForm.is_free" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="是否启用">
              <el-switch v-model="modelForm.is_active" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="showModelDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveModel">
          {{ editingModel ? '更新' : '创建' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 模型测试对话框 -->
    <el-dialog
      v-model="showTestDialog"
      title="模型测试"
      width="600px"
    >
      <div v-if="testingModel">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="模型名称">{{ testingModel.display_name }}</el-descriptions-item>
          <el-descriptions-item label="提供商">{{ testingModel.provider }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{ testingModel.model_type }}</el-descriptions-item>
          <el-descriptions-item label="API地址">{{ testingModel.api_url }}</el-descriptions-item>
        </el-descriptions>
        
        <div style="margin-top: 20px;">
          <el-form>
            <el-form-item label="测试消息">
              <el-input 
                v-model="testMessage"
                type="textarea"
                rows="3"
                placeholder="输入测试消息，如：Hello, how are you?"
              />
            </el-form-item>
          </el-form>
          
          <el-button 
            type="primary" 
            @click="runModelTest"
            :loading="testRunning"
            style="margin-bottom: 15px;"
          >
            开始测试
          </el-button>
          
          <div v-if="testResult" class="test-result">
            <h4>测试结果：</h4>
            <el-card>
              <div v-if="testResult.success" class="test-success">
                <div class="result-header">
                  <el-tag type="success">测试成功</el-tag>
                  <el-tag v-if="testResult.note" type="warning" size="small">{{ testResult.note }}</el-tag>
                </div>
                <div class="result-info">
                  <p><strong>模型：</strong>{{ testResult.model_name }}</p>
                  <p><strong>响应时间：</strong>{{ testResult.duration }}ms</p>
                </div>
                <div class="result-content">
                  <p><strong>AI回复：</strong></p>
                  <div class="ai-response">{{ testResult.response }}</div>
                </div>
              </div>
              <div v-else class="test-error">
                <el-tag type="danger">测试失败</el-tag>
                <p><strong>错误信息：</strong></p>
                <pre>{{ testResult.error }}</pre>
              </div>
            </el-card>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showTestDialog = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '@/utils/api'
import { ElMessage, ElMessageBox } from 'element-plus'

// 响应式数据
const loading = ref(false)
const saving = ref(false)
const testRunning = ref(false)
const models = ref([])
const selectedModels = ref([])
const searchKeyword = ref('')
const filterProvider = ref('')
const filterStatus = ref('')
const filterType = ref('')
const showModelDialog = ref(false)
const showTestDialog = ref(false)
const editingModel = ref(null)
const testingModel = ref(null)
const testMessage = ref('Hello, how are you?')
const testResult = ref(null)
const modelFormRef = ref()

const modelForm = reactive({
  name: '',
  display_name: '',
  description: '',
  model_type: 'text',
  provider: 'dify',
  api_url: '',
  api_key: '',
  icon_path: '',
  sort_order: 0,
  is_free: true,
  is_active: true
})

const modelRules = {
  name: [{ required: true, message: '请输入模型名称', trigger: 'blur' }],
  display_name: [{ required: true, message: '请输入显示名称', trigger: 'blur' }],
  model_type: [{ required: true, message: '请选择模型类型', trigger: 'change' }],
  provider: [{ required: true, message: '请选择提供商', trigger: 'change' }],
  api_url: [{ required: true, message: '请输入API地址', trigger: 'blur' }],
  api_key: [{ required: true, message: '请输入API密钥', trigger: 'blur' }]
}

// 计算属性
const filteredModels = computed(() => {
  let result = models.value

  if (searchKeyword.value) {
    result = result.filter(model => 
      model.display_name.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
      model.name.toLowerCase().includes(searchKeyword.value.toLowerCase())
    )
  }

  if (filterProvider.value) {
    result = result.filter(model => model.provider === filterProvider.value)
  }

  if (filterStatus.value) {
    result = result.filter(model => 
      filterStatus.value === 'active' ? model.is_active : !model.is_active
    )
  }

  if (filterType.value) {
    result = result.filter(model => model.model_type === filterType.value)
  }

  return result
})

const providers = computed(() => {
  const allProviders = models.value.map(model => model.provider)
  return [...new Set(allProviders)].filter(Boolean)
})

// 方法
const loadModels = async () => {
  loading.value = true
  try {
    const response = await api.get('/admin/models')
    if (response.success) {
      models.value = response.data.map(model => ({ ...model, testing: false }))
    }
  } catch (error) {
    console.error('加载模型列表失败:', error)
    ElMessage.error('加载模型列表失败')
  } finally {
    loading.value = false
  }
}

const handleSelectionChange = (selection) => {
  selectedModels.value = selection
}

const handleSortChange = ({ prop, order }) => {
  if (!order) return
  
  models.value.sort((a, b) => {
    let valueA = a[prop]
    let valueB = b[prop]
    
    if (prop === 'created_at') {
      valueA = new Date(valueA).getTime()
      valueB = new Date(valueB).getTime()
    }
    
    if (order === 'ascending') {
      return valueA > valueB ? 1 : -1
    } else {
      return valueA < valueB ? 1 : -1
    }
  })
}

const openModelDialog = (model = null) => {
  if (model) {
    editingModel.value = model
    Object.assign(modelForm, {
      ...model,
      is_free: !!model.is_free,
      is_active: !!model.is_active
    })
  } else {
    editingModel.value = null
    Object.assign(modelForm, {
      name: '',
      display_name: '',
      description: '',
      model_type: 'text',
      provider: 'dify',
      api_url: '',
      api_key: '',
      icon_path: '',
      sort_order: 0,
      is_free: true,
      is_active: true
    })
  }
  showModelDialog.value = true
}

const saveModel = async () => {
  try {
    await modelFormRef.value.validate()
  } catch (error) {
    return
  }

  saving.value = true
  try {
    if (editingModel.value) {
      await api.put(`/admin/models/${editingModel.value.id}`, modelForm)
      ElMessage.success('模型更新成功')
    } else {
      await api.post('/admin/models', modelForm)
      ElMessage.success('模型创建成功')
    }
    showModelDialog.value = false
    await loadModels()
  } catch (error) {
    console.error('保存模型失败:', error)
    ElMessage.error('保存模型失败')
  } finally {
    saving.value = false
  }
}

const toggleModelStatus = async (model) => {
  try {
    await api.put(`/admin/models/${model.id}`, {
      ...model,
      is_active: !model.is_active
    })
    model.is_active = !model.is_active
    ElMessage.success(`模型已${model.is_active ? '启用' : '禁用'}`)
  } catch (error) {
    console.error('切换模型状态失败:', error)
    ElMessage.error('操作失败')
  }
}

const batchToggleStatus = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要批量切换选中的 ${selectedModels.value.length} 个模型的状态吗？`,
      '确认操作',
      { type: 'warning' }
    )
    
    for (const model of selectedModels.value) {
      await toggleModelStatus(model)
    }
    selectedModels.value = []
  } catch (error) {
    if (error !== 'cancel') {
      console.error('批量操作失败:', error)
    }
  }
}

const testModel = (model) => {
  testingModel.value = model
  testResult.value = null
  showTestDialog.value = true
}

const runModelTest = async () => {
  if (!testMessage.value.trim()) {
    ElMessage.error('请输入测试消息')
    return
  }

  testRunning.value = true
  testResult.value = null
  
  try {
    const startTime = Date.now()
    const response = await api.post(`/admin/models/${testingModel.value.id}/test`, {
      message: testMessage.value
    })
    const duration = Date.now() - startTime
    
    testResult.value = {
      success: true,
      response: response.data.response,
      duration
    }
  } catch (error) {
    testResult.value = {
      success: false,
      error: error.response?.data?.message || error.message || '测试失败'
    }
  } finally {
    testRunning.value = false
  }
}

const deleteModel = async (model) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除模型 "${model.display_name}" 吗？`,
      '确认删除',
      { type: 'warning' }
    )
    
    await api.delete(`/admin/models/${model.id}`)
    ElMessage.success('模型删除成功')
    await loadModels()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除模型失败:', error)
      ElMessage.error('删除模型失败')
    }
  }
}

const handleActionCommand = (command, row) => {
  const [action, id] = command.split('-')
  
  switch (action) {
    case 'toggle':
      toggleModelStatus(row)
      break
    case 'delete':
      deleteModel(row)
      break
    default:
      console.warn('未知的操作命令:', command)
  }
}

const formatTime = (timeString) => {
  if (!timeString) return ''
  return new Date(timeString).toLocaleString('zh-CN')
}

// 生命周期
onMounted(() => {
  loadModels()
})
</script>

<style scoped>
.test-result {  margin-top: 15px;}.result-header {  display: flex;  align-items: center;  gap: 10px;  margin-bottom: 15px;}.result-info {  margin-bottom: 15px;}.result-info p {  margin: 5px 0;  color: #606266;}.result-content {  margin-top: 15px;}.ai-response {  background-color: #f8f9fa;  border: 1px solid #e4e7ed;  border-radius: 6px;  padding: 15px;  margin-top: 8px;  white-space: pre-wrap;  word-wrap: break-word;  max-height: 200px;  overflow-y: auto;  line-height: 1.6;  color: #303133;  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;}.test-success pre,.test-error pre {  background-color: #f5f5f5;  padding: 10px;  border-radius: 4px;  white-space: pre-wrap;  word-wrap: break-word;  max-height: 200px;  overflow-y: auto;}.test-success {  color: #67c23a;}.test-error {  color: #f56c6c;}
</style> 