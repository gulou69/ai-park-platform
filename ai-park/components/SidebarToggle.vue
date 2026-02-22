<!-- 这部分代码是左边栏的收起和展开按钮，感觉没啥好改的，所以不加注释了 -->
<template>
  <view class="sidebar-toggle" @click="$emit('toggle')">
    <text class="toggle-icon">{{ isCollapsed ? '>' : '<' }}</text>
  </view>
</template>

<script>
export default {
  name: 'SidebarToggle',
  props: {
    isCollapsed: {
      type: Boolean,
      default: false
    }
  }
}
</script>

<style lang="scss">
.sidebar-toggle {
  position: fixed;
  left: 278px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 48px;
  background: var(--input-bg);
  border-radius: 0 24px 24px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 100;
  box-shadow: 2px 0 4px var(--shadow-color);
  transform-origin: center;
  
  &:hover {
    background: var(--hover-bg);
    width: 28px;
    transform: translateY(-50%) scale(1.05);
  }
  
  .toggle-icon {
    color: var(--text-secondary);
    font-size: 16px;
    font-weight: 700;
    line-height: 1;
    user-select: none;
    margin-left: 2px;
    transition: transform 0.3s ease;
  }
  
  @media (max-width: 768px) {
    display: none; // 在移动端隐藏收起按钮
  }
}
</style>
