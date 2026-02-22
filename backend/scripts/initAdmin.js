const db = require('../utils/db');
const Admin = require('../models/admin');

/**
 * 初始化管理员账户和数据表
 */
async function initializeAdmin() {
    try {
        console.log('开始初始化管理员系统...');

        // 创建管理员表
        await db.query(`
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员表'
        `);

        console.log('✅ 管理员表创建成功');

        // 检查是否已存在超级管理员
        const [existingAdmins] = await db.query(
            'SELECT COUNT(*) as count FROM admins WHERE role = "super_admin"'
        );

        if (existingAdmins[0].count === 0) {
            // 创建默认超级管理员
            const defaultAdmin = {
                username: 'admin',
                password: 'admin123',
                email: 'admin@example.com',
                role: 'super_admin',
                permissions: [
                    'user_management',
                    'model_management',
                    'conversation_management',
                    'system_stats',
                    'admin_management'
                ]
            };

            await Admin.create(defaultAdmin);
            console.log('✅ 默认超级管理员创建成功');
            console.log('📝 用户名: admin');
            console.log('📝 密码: admin123（请立即修改）');
            console.log('⚠️  请在生产环境中修改默认密码！');
        } else {
            console.log('ℹ️  超级管理员已存在，跳过创建');
        }

        console.log('🎉 管理员系统初始化完成！');

        // 显示管理员列表
        const admins = await Admin.getAll();
        console.log('\n当前管理员列表:');
        admins.forEach(admin => {
            console.log(`- ${admin.username} (${admin.role}) - ${admin.is_active ? '启用' : '禁用'}`);
        });

    } catch (error) {
        console.error('❌ 初始化管理员系统失败:', error);
        throw error;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    initializeAdmin()
        .then(() => {
            console.log('\n✅ 初始化完成，正在退出...');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ 初始化失败:', error);
            process.exit(1);
        });
}

module.exports = initializeAdmin;
