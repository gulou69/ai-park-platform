const mysql = require('mysql2/promise');
const path = require('path');

// 根据环境加载不同的.env文件
const envFile = process.env.NODE_ENV === 'production' ? '.env.docker' : '.env';
require('dotenv').config({ path: path.resolve(process.cwd(), envFile) });

// 调试输出环境变量
console.log(`使用环境配置文件: ${envFile}`);
console.log('MySQL环境变量:', {
    host: process.env.MYSQL_HOST || '未设置',
    port: process.env.MYSQL_PORT || '未设置',
    user: process.env.MYSQL_USER || '未设置',
    password: process.env.MYSQL_PASSWORD ? '已设置' : '未设置',
    database: process.env.MYSQL_DATABASE || '未设置'
});

// 创建数据库连接池，添加更多配置提高稳定性
const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'ai_park',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // 字符集设置
    charset: 'utf8mb4'
});

// 测试连接
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ MySQL连接成功');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ MySQL连接失败:', error);
        console.error('请检查MySQL服务是否启动，以及.env文件中的数据库配置是否正确');
        return false;
    }
}

// 导出前测试连接
testConnection();

module.exports = pool;
