import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/utils/api'

export const useAuthStore = defineStore('auth', () => {
  // 状态
  const token = ref(localStorage.getItem('admin_token') || '')
  const adminInfo = ref(JSON.parse(localStorage.getItem('admin_info') || '{}'))
  const rolesData = ref({})

  // 计算属性
  const isLoggedIn = computed(() => !!token.value && !!adminInfo.value.id)
  
  const hasPermission = computed(() => {
    return (permission) => {
      if (!adminInfo.value.role) return false
      if (adminInfo.value.role === 'super_admin') return true
      return adminInfo.value.permissions?.includes(permission) || false
    }
  })

  const hasRole = computed(() => {
    return (role) => adminInfo.value.role === role
  })

  const hasAnyRole = computed(() => {
    return (roles) => {
      if (!Array.isArray(roles)) roles = [roles]
      return roles.includes(adminInfo.value.role)
    }
  })

  const canAccessPage = computed(() => {
    return (page) => {
      const pagePermissions = {
        dashboard: ['system_stats'],
        users: ['user_management'],
        models: ['model_management'],
        conversations: ['conversation_management'],
        admins: ['admin_management']
        // 验证码管理无需特殊权限，所有管理员都可访问
      }
      
      const requiredPermissions = pagePermissions[page]
      if (!requiredPermissions) return true
      
      return requiredPermissions.some(permission => hasPermission.value(permission))
    }
  })

  const getRoleName = computed(() => {
    const roleNames = {
      'super_admin': '超级管理员',
      'admin': '管理员', 
      'operator': '操作员'
    }
    return roleNames[adminInfo.value.role] || '未知角色'
  })

  // 方法
  const login = async (credentials) => {
    try {
      const response = await api.post('/admin/login', credentials)
      if (response.success) {
        token.value = response.data.token
        adminInfo.value = response.data.admin
        
        // 保存到本地存储
        localStorage.setItem('admin_token', token.value)
        localStorage.setItem('admin_info', JSON.stringify(adminInfo.value))
        
        // 获取角色信息
        await fetchRolesData()
        
        return { success: true }
      }
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || '登录失败'
      }
    }
  }

  const logout = () => {
    token.value = ''
    adminInfo.value = {}
    rolesData.value = {}
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_info')
  }

  const updateAdminInfo = (newInfo) => {
    adminInfo.value = { ...adminInfo.value, ...newInfo }
    localStorage.setItem('admin_info', JSON.stringify(adminInfo.value))
  }

  const fetchRolesData = async () => {
    try {
      const response = await api.get('/admin/roles')
      if (response.success) {
        rolesData.value = response.data
      }
    } catch (error) {
      console.error('获取角色数据失败:', error)
    }
  }

  const refreshUserInfo = async () => {
    try {
      const response = await api.get('/admin/me')
      if (response.success) {
        adminInfo.value = response.data
        localStorage.setItem('admin_info', JSON.stringify(adminInfo.value))
      }
    } catch (error) {
      console.error('刷新用户信息失败:', error)
    }
  }

  return {
    // 状态
    token,
    adminInfo,
    rolesData,
    
    // 计算属性
    isLoggedIn,
    hasPermission,
    hasRole,
    hasAnyRole,
    canAccessPage,
    getRoleName,
    
    // 方法
    login,
    logout,
    updateAdminInfo,
    fetchRolesData,
    refreshUserInfo
  }
}) 