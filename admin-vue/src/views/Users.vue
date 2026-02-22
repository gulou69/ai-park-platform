<template>
  <div class="page-container">
    <div class="page-header">
      <h2>用户管理</h2>
    </div>

    <!-- 工具栏 -->
    <div class="table-toolbar">
      <div class="toolbar-left">
        <el-input
          v-model="searchForm.search"
          placeholder="搜索手机号"
          style="width: 200px;"
          prefix-icon="Search"
          @input="handleSearch"
          clearable
        />
        <el-select
          v-model="searchForm.status"
          placeholder="用户状态"
          style="width: 120px;"
          @change="handleSearch"
          clearable
        >
          <el-option label="正常" value="true" />
          <el-option label="禁用" value="false" />
        </el-select>
      </div>
      <div class="toolbar-right">
        <el-button @click="loadUsers" :loading="loading">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="data-table">
      <el-table :data="users" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="phone" label="手机号" width="150" />
        <el-table-column label="头像" width="80">
          <template #default="{ row }">
            <el-avatar :size="32" :src="row.avatar">
              <el-icon><User /></el-icon>
            </el-avatar>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'danger'">
              {{ row.is_active ? '正常' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="last_login" label="最后登录" width="180">
          <template #default="{ row }">
            {{ formatTime(row.last_login) }}
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="注册时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <div class="primary-actions">
                <el-button
                  :type="row.is_active ? 'danger' : 'success'"
                  size="small"
                  @click="updateUserStatus(row)"
                  :loading="row.updating"
                  :title="row.is_active ? '禁用用户' : '启用用户'"
                >
                  <el-icon><Switch /></el-icon>
                  <span class="button-text">{{ row.is_active ? '禁用' : '启用' }}</span>
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
          @current-change="loadUsers"
          @size-change="loadUsers"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '@/utils/api'
import { ElMessage, ElMessageBox } from 'element-plus'

// 响应式数据
const loading = ref(false)
const users = ref([])

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

const searchForm = reactive({
  search: '',
  status: ''
})

// 防抖搜索
let searchTimer = null
const handleSearch = () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    pagination.page = 1
    loadUsers()
  }, 500)
}

// 方法
const loadUsers = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      search: searchForm.search || undefined,
      status: searchForm.status || undefined
    }
    
    const response = await api.get('/admin/users', { params })
    if (response.success) {
      users.value = response.data.users.map(user => ({ ...user, updating: false }))
      pagination.total = response.data.pagination.total
    }
  } catch (error) {
    console.error('加载用户列表失败:', error)
    ElMessage.error('加载用户列表失败')
  } finally {
    loading.value = false
  }
}

const updateUserStatus = async (user) => {
  try {
    const action = user.is_active ? '禁用' : '启用'
    await ElMessageBox.confirm(
      `确定要${action}用户 "${user.phone}" 吗？`,
      '确认操作',
      {
        type: 'warning'
      }
    )
    
    user.updating = true
    await api.patch(`/admin/users/${user.id}/status`, {
      is_active: !user.is_active
    })
    
    user.is_active = !user.is_active
    ElMessage.success(`用户${action}成功`)
  } catch (error) {
    if (error !== 'cancel') {
      console.error('更新用户状态失败:', error)
    }
  } finally {
    user.updating = false
  }
}

const formatTime = (timeString) => {
  if (!timeString) return '从未'
  return new Date(timeString).toLocaleString('zh-CN')
}

// 生命周期
onMounted(() => {
  loadUsers()
})
</script>

<style scoped>
/* 样式已在全局样式中定义 */
</style> 