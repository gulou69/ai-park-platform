<template>
  <div class="admin-layout">
    <!-- 侧边栏 -->
    <div class="sidebar" :class="{ collapsed: sidebarCollapsed }">
      <div class="logo">
        <h1 v-if="!sidebarCollapsed">AI Park 管理</h1>
        <h1 v-else>AP</h1>
      </div>
      
      <el-menu
        :default-active="activeMenu"
        :collapse="sidebarCollapsed"
        :unique-opened="true"
        router
        background-color="#001529"
        text-color="#ffffff"
        active-text-color="#1890ff"
      >
        <template v-for="route in menuRoutes" :key="route.path">
          <el-menu-item 
            v-if="hasMenuPermission(route)"
            :index="route.path"
          >
            <el-icon>
              <component :is="route.meta.icon" />
            </el-icon>
            <span>{{ route.meta.title }}</span>
          </el-menu-item>
        </template>
      </el-menu>
    </div>

    <!-- 主内容区 -->
    <div class="main-content">
      <!-- 头部 -->
      <div class="header">
        <div class="header-left">
          <el-button 
            type="text" 
            @click="toggleSidebar"
            class="sidebar-toggle"
          >
            <el-icon>
              <Expand v-if="sidebarCollapsed" />
              <Fold v-else />
            </el-icon>
          </el-button>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item>{{ currentRoute.meta.title }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        
        <div class="header-right">
          <el-dropdown @command="handleUserMenu">
            <div class="user-info">
              <el-avatar :size="32" :src="adminInfo.avatar">
                <el-icon><UserFilled /></el-icon>
              </el-avatar>
              <span class="username">{{ adminInfo.username }}</span>
              <el-tag type="info" size="small">{{ authStore.getRoleName }}</el-tag>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="changePassword">修改密码</el-dropdown-item>
                <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

      <!-- 内容区 -->
      <div class="content">
        <router-view />
      </div>
    </div>

    <!-- 修改密码对话框 -->
    <el-dialog
      v-model="showPasswordDialog"
      title="修改密码"
      width="400px"
      :close-on-click-modal="false"
    >
      <el-form :model="passwordForm" label-width="80px" ref="passwordFormRef">
        <el-form-item 
          label="当前密码" 
          prop="currentPassword"
          :rules="[{ required: true, message: '请输入当前密码', trigger: 'blur' }]"
        >
          <el-input
            v-model="passwordForm.currentPassword"
            type="password"
            placeholder="请输入当前密码"
            show-password
            :disabled="changingPassword"
          />
        </el-form-item>
        <el-form-item 
          label="新密码" 
          prop="newPassword"
          :rules="[
            { required: true, message: '请输入新密码', trigger: 'blur' },
            { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
          ]"
        >
          <el-input
            v-model="passwordForm.newPassword"
            type="password"
            placeholder="请输入新密码"
            show-password
            :disabled="changingPassword"
          />
        </el-form-item>
        <el-form-item 
          label="确认密码" 
          prop="confirmPassword"
          :rules="[
            { required: true, message: '请再次输入新密码', trigger: 'blur' },
            { 
              validator: (rule, value, callback) => {
                if (value !== passwordForm.newPassword) {
                  callback(new Error('两次输入的密码不一致'))
                } else {
                  callback()
                }
              }, 
              trigger: 'blur' 
            }
          ]"
        >
          <el-input
            v-model="passwordForm.confirmPassword"
            type="password"
            placeholder="请再次输入新密码"
            show-password
            :disabled="changingPassword"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closePasswordDialog" :disabled="changingPassword">取消</el-button>
        <el-button 
          type="primary" 
          @click="handleChangePassword"
          :loading="changingPassword"
        >
          {{ changingPassword ? '修改中...' : '确定' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// 响应式数据
const sidebarCollapsed = ref(false)
const showPasswordDialog = ref(false)
const changingPassword = ref(false)
const passwordFormRef = ref(null)
const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

// 计算属性
const adminInfo = computed(() => authStore.adminInfo)
const currentRoute = computed(() => route)
const activeMenu = computed(() => route.path)

// 菜单路由
const menuRoutes = computed(() => {
  return router.getRoutes()
    .find(r => r.name === 'Layout')
    ?.children.filter(child => child.meta?.title) || []
})

// 方法
const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

const hasMenuPermission = (menuRoute) => {
  // 如果设置了权限要求，检查权限
  if (menuRoute.meta.permission) {
    return authStore.hasPermission(menuRoute.meta.permission)
  }
  
  // 如果设置了角色要求，检查角色
  if (menuRoute.meta.roles) {
    return authStore.hasAnyRole(menuRoute.meta.roles)
  }
  
  // 如果设置了单个角色要求
  if (menuRoute.meta.role) {
    return authStore.hasRole(menuRoute.meta.role)
  }
  
  // 基于页面名称的权限检查
  const pageName = menuRoute.name?.toLowerCase()
  if (pageName) {
    return authStore.canAccessPage(pageName)
  }
  
  return true
}

const handleUserMenu = (command) => {
  switch (command) {
    case 'changePassword':
      showPasswordDialog.value = true
      // 重置表单
      passwordForm.value = {
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }
      break
    case 'logout':
      handleLogout()
      break
  }
}

const closePasswordDialog = () => {
  showPasswordDialog.value = false
  // 重置表单
  passwordForm.value = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  }
  // 清除验证状态
  passwordFormRef.value?.clearValidate()
}

const handleChangePassword = async () => {
  // 先进行表单验证
  if (!passwordFormRef.value) return
  
  try {
    await passwordFormRef.value.validate()
  } catch (error) {
    return // 验证失败，不继续执行
  }

  const { currentPassword, newPassword } = passwordForm.value

  changingPassword.value = true
  try {
    const response = await api.post('/admin/change-password', {
      currentPassword,
      newPassword
    })

    if (response.success) {
      ElMessage.success('密码修改成功')
      closePasswordDialog()
    }
  } catch (error) {
    console.error('修改密码失败:', error)
    ElMessage.error(error.response?.data?.message || '修改密码失败')
  } finally {
    changingPassword.value = false
  }
}

const handleLogout = () => {
  ElMessageBox.confirm('确定要退出登录吗？', '确认', {
    type: 'warning'
  }).then(() => {
    authStore.logout()
    router.push('/login')
    ElMessage.success('已退出登录')
  })
}

// 监听路由变化
watch(route, () => {
  // 可以在这里处理路由变化时的逻辑
}, { immediate: true })
</script>

<style scoped>
.admin-layout {
  height: 100vh;
  display: flex;
}

.sidebar {
  width: 250px;
  background: #001529;
  color: white;
  flex-shrink: 0;
  transition: width 0.3s;
}

.sidebar.collapsed {
  width: 64px;
}

.logo {
  padding: 20px;
  text-align: center;
  border-bottom: 1px solid #002140;
}

.logo h1 {
  color: white;
  font-size: 18px;
  margin: 0;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  height: 60px;
  background: white;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.sidebar-toggle {
  font-size: 16px;
  color: #666;
}

.header-right {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.user-info:hover {
  background-color: #f5f5f5;
}

.username {
  font-size: 14px;
  color: #333;
}

.content {
  flex: 1;
  overflow-y: auto;
  background: #f0f2f5;
}

:deep(.el-menu) {
  border-right: none;
}

:deep(.el-menu-item) {
  border-bottom: 1px solid #002140;
}

:deep(.el-menu-item:hover) {
  background-color: #1890ff !important;
  color: #ffffff !important;
}

:deep(.el-menu-item.is-active) {
  background-color: #1890ff !important;
  color: #ffffff !important;
}

:deep(.el-menu-item.is-active span) {
  color: #ffffff !important;
}

:deep(.el-menu-item.is-active .el-icon) {
  color: #ffffff !important;
}
</style> 