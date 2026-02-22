<template>
  <div class="page-container">
    <div class="page-header">
      <h2>管理员管理</h2>
    </div>

    <!-- 工具栏 -->
    <div class="table-toolbar">
      <div class="toolbar-left">
        <span>管理员总数: {{ admins.length }}</span>
      </div>
      <div class="toolbar-right">
        <el-button type="primary" @click="openAdminDialog()">
          <el-icon><Plus /></el-icon>
          添加管理员
        </el-button>
        <el-button @click="loadAdmins" :loading="loading">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="data-table">
      <el-table :data="admins" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" label="用户名" />
        <el-table-column prop="email" label="邮箱" />
        <el-table-column label="角色" width="120">
          <template #default="{ row }">
            <el-tag :type="row.role === 'super_admin' ? 'danger' : 'primary'">
              {{ getRoleLabel(row.role) }}
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
        <el-table-column prop="last_login" label="最后登录" width="180">
          <template #default="{ row }">
            {{ formatTime(row.last_login) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <div class="primary-actions">
                <el-button 
                  v-if="canEditAdmin(row)"
                  size="small" 
                  @click="openAdminDialog(row)" 
                  title="编辑管理员"
                >
                  <el-icon><Edit /></el-icon>
                  <span class="button-text">编辑</span>
                </el-button>
                <el-switch
                  v-if="canToggleStatus(row)"
                  :model-value="row.is_active"
                  :before-change="() => toggleAdminStatus(row)"
                  active-text="启用"
                  inactive-text="禁用"
                  size="small"
                  style="margin-left: 8px;"
                />
              </div>
              <div class="secondary-actions">
                <el-button 
                  v-if="canDeleteAdmin(row)"
                  type="danger" 
                  size="small" 
                  @click="deleteAdmin(row)"
                  title="删除管理员"
                >
                  <el-icon><Delete /></el-icon>
                  <span class="button-text">删除</span>
                </el-button>
              </div>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 管理员编辑对话框 -->
    <el-dialog
      v-model="showAdminDialog"
      :title="editingAdmin ? '编辑管理员' : '添加管理员'"
      width="600px"
    >
      <div v-if="isEditingSuperAdminSelf" class="edit-warning">
        <el-alert
          title="注意：超级管理员不能修改自己的用户名、角色和状态"
          type="warning"
          :closable="false"
          style="margin-bottom: 20px;"
        />
      </div>
      <el-form :model="adminForm" label-width="100px" class="dialog-form">
        <el-form-item label="用户名" required>
          <el-input 
            v-model="adminForm.username" 
            :disabled="isEditingSuperAdminSelf"
          />
        </el-form-item>
        <el-form-item label="密码" :required="!editingAdmin">
          <el-input 
            v-model="adminForm.password" 
            type="password" 
            :placeholder="editingAdmin ? '留空则不修改' : '请输入密码'" 
          />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="adminForm.email" />
        </el-form-item>
        <el-form-item label="角色" required>
          <el-select v-model="adminForm.role" style="width: 100%;">
            <el-option
              v-for="role in roleOptions"
              :key="role.value"
              :label="role.label"
              :value="role.value"
              :disabled="role.disabled"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="角色权限">
          <div class="role-permissions">
            <el-tag
              v-for="permission in getRolePermissions(adminForm.role)"
              :key="permission"
              type="info"
              size="small"
              style="margin-right: 8px; margin-bottom: 4px;"
            >
              {{ permission }}
            </el-tag>
            <div v-if="getRolePermissions(adminForm.role).length === 0" class="no-permissions">
              该角色暂无权限
            </div>
          </div>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch
            v-model="adminForm.is_active"
            :disabled="isEditingSuperAdminSelf"
            active-text="启用"
            inactive-text="禁用"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAdminDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveAdmin">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import api from '@/utils/api'
import { useAuthStore } from '@/stores/auth'
import { ElMessage, ElMessageBox } from 'element-plus'

const authStore = useAuthStore()
const loading = ref(false)
const saving = ref(false)
const admins = ref([])
const showAdminDialog = ref(false)
const editingAdmin = ref(null)

const adminForm = reactive({
  username: '',
  password: '',
  email: '',
  role: 'operator',
  is_active: true
})

// 根据当前用户角色获取可用的角色选项
const roleOptions = computed(() => {
  const currentUserRole = authStore.adminInfo.role
  const currentUserId = authStore.adminInfo.id
  
  if (currentUserRole === 'super_admin') {
    const options = [
      { value: 'super_admin', label: '超级管理员', disabled: false },
      { value: 'admin', label: '管理员', disabled: false },
      { value: 'operator', label: '操作员', disabled: false }
    ]
    
    // 如果正在编辑超级管理员自己，禁用除自己当前角色外的其他选项
    if (editingAdmin.value && editingAdmin.value.role === 'super_admin' && editingAdmin.value.id === currentUserId) {
      return options.map(option => ({
        ...option,
        disabled: option.value !== 'super_admin'
      }))
    }
    
    return options
  }
  
  // 非超级管理员不能创建管理员
  return []
})

// 获取角色权限描述
const getRolePermissions = (role) => {
  const permissions = {
    'super_admin': ['用户管理', '模型管理', '会话管理', '管理员管理', '系统统计', '系统配置'],
    'admin': ['用户管理', '模型管理', '会话管理', '系统统计'],
    'operator': ['模型管理', '系统统计']
  }
  return permissions[role] || []
}

const loadAdmins = async () => {
  loading.value = true
  try {
    const response = await api.get('/admin/admins')
    if (response.success) {
      admins.value = response.data.admins.map(admin => ({
        ...admin,
        is_active: !!admin.is_active
      }))
    }
  } catch (error) {
    console.error('加载管理员列表失败:', error)
    ElMessage.error('加载管理员列表失败')
  } finally {
    loading.value = false
  }
}

const openAdminDialog = (admin = null) => {
  if (admin) {
    editingAdmin.value = admin
    Object.assign(adminForm, {
      username: admin.username,
      email: admin.email,
      role: admin.role,
      is_active: admin.is_active,
      password: ''
    })
  } else {
    editingAdmin.value = null
    Object.assign(adminForm, {
      username: '',
      password: '',
      email: '',
      role: 'operator',
      is_active: true
    })
  }
  showAdminDialog.value = true
}

const saveAdmin = async () => {
  if (!adminForm.username.trim()) {
    ElMessage.error('请输入用户名')
    return
  }
  
  if (!editingAdmin.value && !adminForm.password.trim()) {
    ElMessage.error('新建管理员必须设置密码')
    return
  }

  if (adminForm.password && adminForm.password.length < 6) {
    ElMessage.error('密码长度不能少于6位')
    return
  }

  saving.value = true
  try {
    const data = { ...adminForm }
    if (!data.password) delete data.password
    
    if (editingAdmin.value) {
      await api.put(`/admin/admins/${editingAdmin.value.id}`, data)
      ElMessage.success('管理员更新成功')
    } else {
      await api.post('/admin/admins', data)
      ElMessage.success('管理员创建成功')
    }
    showAdminDialog.value = false
    await loadAdmins()
  } catch (error) {
    console.error('保存管理员失败:', error)
    ElMessage.error(error.response?.data?.message || '保存管理员失败')
  } finally {
    saving.value = false
  }
}

const deleteAdmin = async (admin) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除管理员 "${admin.username}" 吗？`,
      '确认删除',
      { type: 'warning' }
    )
    
    await api.delete(`/admin/admins/${admin.id}`)
    ElMessage.success('管理员删除成功')
    await loadAdmins()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除管理员失败:', error)
    }
  }
}

const getRoleLabel = (role) => {
  const roleMap = {
    'super_admin': '超级管理员',
    'admin': '管理员',
    'operator': '操作员'
  }
  return roleMap[role] || role
}

const formatTime = (timeString) => {
  if (!timeString) return '从未'
  return new Date(timeString).toLocaleString('zh-CN')
}

const canEditAdmin = (admin) => {
  const currentUserRole = authStore.adminInfo.role
  const currentUserId = authStore.adminInfo.id
  
  // 只有超级管理员可以编辑
  if (currentUserRole !== 'super_admin') return false
  
  // 超级管理员不能编辑自己
  if (admin.role === 'super_admin' && admin.id === currentUserId) return false
  
  return true
}

const canToggleStatus = (admin) => {
  const currentUserRole = authStore.adminInfo.role
  
  // 只有超级管理员可以切换状态
  if (currentUserRole !== 'super_admin') return false
  
  // 不能切换超级管理员的状态
  if (admin.role === 'super_admin') return false
  
  return true
}

const canDeleteAdmin = (admin) => {
  const currentUserRole = authStore.adminInfo.role
  const currentUserId = authStore.adminInfo.id
  
  // 只有超级管理员可以删除
  if (currentUserRole !== 'super_admin') return false
  
  // 不能删除超级管理员
  if (admin.role === 'super_admin') return false
  
  // 不能删除自己
  if (admin.id === currentUserId) return false
  
  return true
}

const toggleAdminStatus = async (admin) => {
  try {
    const response = await api.patch(`/admin/admins/${admin.id}/status`)
    
    if (response.success) {
      const newStatus = response.data.is_active
      admin.is_active = newStatus
      ElMessage.success(`管理员已${newStatus ? '启用' : '禁用'}`)
      return Promise.resolve(true)
    } else {
      ElMessage.error('状态切换失败')
      return Promise.reject(false)
    }
  } catch (error) {
    console.error('更新管理员状态失败:', error)
    ElMessage.error(error.response?.data?.message || '更新管理员状态失败')
    return Promise.reject(false)
  }
}

const isEditingSuperAdminSelf = computed(() => {
  const currentUserRole = authStore.adminInfo.role
  const currentUserId = authStore.adminInfo.id
  
  if (editingAdmin.value && editingAdmin.value.role === 'super_admin' && editingAdmin.value.id === currentUserId) {
    return true
  }
  
  return false
})

onMounted(() => {
  loadAdmins()
})
</script>

<style scoped>
.page-container {
  padding: 20px;
  background: #f0f2f5;
  min-height: 100vh;
}

.page-header {
  background: white;
  padding: 16px 20px;
  border-radius: 8px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.page-header h2 {
  margin: 0;
  color: #333;
  font-size: 18px;
  font-weight: 500;
}

.table-toolbar {
  background: white;
  padding: 16px 20px;
  border-radius: 8px;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.toolbar-left {
  color: #666;
  font-size: 14px;
}

.toolbar-right {
  display: flex;
  gap: 8px;
}

.data-table {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.table-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
}

.primary-actions, .secondary-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.button-text {
  font-size: 12px;
}

.dialog-form {
  padding: 0 20px;
}

.role-permissions {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 8px;
  min-height: 40px;
  background-color: #fafafa;
}

.no-permissions {
  color: #999;
  font-style: italic;
  font-size: 12px;
}

:deep(.el-switch__label) {
  font-size: 12px;
}

:deep(.el-switch__label.is-active) {
  color: #409eff;
}

@media (max-width: 768px) {
  .button-text {
    display: none;
  }
  
  .table-actions {
    flex-direction: row;
    flex-wrap: wrap;
  }
  
  .primary-actions, .secondary-actions {
    flex-direction: column;
    gap: 2px;
  }
}
</style> 