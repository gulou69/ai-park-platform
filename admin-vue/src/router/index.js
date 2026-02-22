import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/Login.vue'),
      meta: {
        requiresAuth: false,
        title: '登录'
      }
    },
    {
      path: '/',
      name: 'Layout',
      component: () => import('@/layout/index.vue'),
      redirect: '/dashboard',
      meta: {
        requiresAuth: true
      },
      children: [
        {
          path: 'dashboard',
          name: 'Dashboard',
          component: () => import('@/views/Dashboard.vue'),
          meta: {
            title: '数据统计',
            icon: 'Odometer',
            permission: 'system_stats'
          }
        },
        {
          path: 'users',
          name: 'Users',
          component: () => import('@/views/Users.vue'),
          meta: {
            title: '用户管理',
            icon: 'User',
            permission: 'user_management'
          }
        },
        {
          path: 'models',
          name: 'Models',
          component: () => import('@/views/Models.vue'),
          meta: {
            title: '模型管理',
            icon: 'Cpu',
            permission: 'model_management'
          }
        },
        {
          path: 'conversations',
          name: 'Conversations',
          component: () => import('@/views/Conversations.vue'),
          meta: {
            title: '会话管理',
            icon: 'ChatLineSquare',
            permission: 'conversation_management'
          }
        },
        {
          path: 'verification-codes',
          name: 'VerificationCodes',
          component: () => import('@/views/VerificationCodes.vue'),
          meta: {
            title: '验证码管理',
            icon: 'Message'
          }
        },
        {
          path: 'admins',
          name: 'Admins',
          component: () => import('@/views/Admins.vue'),
          meta: {
            title: '管理员管理',
            icon: 'UserFilled',
            roles: ['super_admin']
          }
        }
      ]
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  
  // 设置页面标题
  if (to.meta.title) {
    document.title = `${to.meta.title} - AI Park 管理后台`
  }
  
  // 检查是否需要登录
  if (to.meta.requiresAuth !== false) {
    if (!authStore.isLoggedIn) {
      next('/login')
      return
    }
    
    // 检查权限
    if (to.meta.permission && !authStore.hasPermission(to.meta.permission)) {
      ElMessage.error('权限不足，无法访问该页面')
      next('/dashboard')
      return
    }
    
    // 检查角色（支持多个角色）
    if (to.meta.roles && !authStore.hasAnyRole(to.meta.roles)) {
      ElMessage.error('角色权限不足，无法访问该页面')
      next('/dashboard')
      return
    }
    
    // 检查单个角色（向后兼容）
    if (to.meta.role && !authStore.hasRole(to.meta.role)) {
      ElMessage.error('角色权限不足，无法访问该页面')
      next('/dashboard')
      return
    }
  } else if (authStore.isLoggedIn && to.path === '/login') {
    // 已登录用户访问登录页，重定向到首页
    next('/dashboard')
    return
  }
  
  next()
})

export default router 