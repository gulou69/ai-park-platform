-- 创建数据库
CREATE DATABASE IF NOT EXISTS ai_park DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE ai_park;

-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(15) NOT NULL UNIQUE COMMENT '手机号',
  password VARCHAR(100) NOT NULL COMMENT '加密后的密码',
  avatar VARCHAR(255) DEFAULT '/static/icons/person-circle.svg' COMMENT '用户头像URL',
  is_active BOOLEAN DEFAULT TRUE COMMENT '用户状态',
  last_login DATETIME NULL COMMENT '最后登录时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 创建模型表
CREATE TABLE IF NOT EXISTS models (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL COMMENT '模型名称',
  display_name VARCHAR(100) NOT NULL COMMENT '显示名称',
  description TEXT NULL COMMENT '模型描述',
  model_type ENUM('text', 'image') DEFAULT 'text' COMMENT '模型类型',
  provider VARCHAR(50) NOT NULL COMMENT '提供商，如dify, openai等',
  api_url VARCHAR(255) NOT NULL COMMENT 'API地址',
  api_key VARCHAR(255) NOT NULL COMMENT 'API密钥',
  icon_path VARCHAR(255) NULL COMMENT '图标路径',
  is_free BOOLEAN DEFAULT TRUE COMMENT '是否免费',
  is_active BOOLEAN DEFAULT TRUE COMMENT '是否可用',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI模型表';

-- 创建会话表
-- 注: 此表不存储具体聊天内容，而是作为本地会话索引
-- 聊天内容由Dify API存储，使用dify_conversation_id关联
CREATE TABLE IF NOT EXISTS conversations (
  id VARCHAR(36) PRIMARY KEY COMMENT 'UUID格式的会话ID',
  user_id INT NOT NULL COMMENT '用户ID',
  title VARCHAR(255) DEFAULT '新对话' COMMENT '会话标题',
  model_id INT NOT NULL COMMENT '使用的模型ID',
  dify_conversation_id VARCHAR(100) NULL COMMENT 'Dify服务中的会话ID',
  last_message TEXT NULL COMMENT '最后一条消息预览',
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '最后更新时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户会话索引表';

-- 创建管理员表
CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
  password VARCHAR(100) NOT NULL COMMENT '加密后的密码',
  email VARCHAR(100) NULL COMMENT '邮箱',
  role ENUM('super_admin', 'admin', 'operator') DEFAULT 'admin' COMMENT '角色',
  permissions JSON NULL COMMENT '权限列表',
  is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  last_login DATETIME NULL COMMENT '最后登录时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员表';


-- -- 插入初始化数据：添加默认模型（示例，请替换为你自己的API密钥）
-- INSERT INTO models (name, display_name, description, model_type, provider, api_url, api_key, icon_path, is_free, is_active) VALUES
-- ('difyai', '通用助手', '适用于日常对话和问答的通用型AI助手', 'text', 'dify', 'http://localhost/v1', 'your-dify-api-key', '/static/icons/robot.svg', TRUE, TRUE),
-- ('deepseek', 'DeepSeek Pro', '强大的大语言模型，适合复杂推理和创意生成', 'text', 'dify', 'http://localhost/v1', 'your-dify-api-key', '/static/icons/robot-color.svg', FALSE, TRUE);

-- -- 创建一个演示用户
-- INSERT INTO users (phone, password, avatar, is_active) VALUES
-- ('13800138000', '$2a$10$ScD7fG.2QcChpCIDwsgjDu27sKQFpJ7oieJs18qcI/ChGxGzg0YN6', '/static/icons/person-circle.svg', TRUE);

-- 插入默认超级管理员（用户名: admin, 默认密码: admin123, 请部署后立即修改）
-- 默认超级管理员（用户名: admin, 默认密码: admin123, 请部署后立即修改）
INSERT INTO admins (username, password, email, role, permissions, is_active) VALUES
(
  'admin', 
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', -- admin123的bcrypt哈希值，请部署后修改
  'admin@example.com', 
  'super_admin',
  JSON_ARRAY(
    'user_management',
    'model_management', 
    'conversation_management',
    'system_stats',
    'admin_management'
  ),
  TRUE
);
