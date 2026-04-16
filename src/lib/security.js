/**
 * API Key 安全模块
 * 
 * 安全策略：
 * 1. 永远不持久化 API Key（不用 localStorage / sessionStorage / cookie）
 * 2. 仅保存在 React state 中，页面关闭即销毁
 * 3. 传输时通过 HTTPS 加密（生产环境）
 * 4. 前端展示时脱敏处理
 * 5. 历史记录中不包含 API Key
 * 6. 页面离开/隐藏时可选择清除
 * 7. 后端 API 不记录/不缓存 Key
 * 8. 防止浏览器自动填充
 */

/**
 * 脱敏 API Key，只显示前4位和后4位
 * sk-xxxxxxxxxxxxxxxx -> sk-xxxx****xxxx
 */
export function maskApiKey(key) {
  if (!key || key.length < 12) return '****'
  const prefix = key.slice(0, 7)  // "sk-xxx"
  const suffix = key.slice(-4)
  return `${prefix}****${suffix}`
}

/**
 * 验证 API Key 格式
 * 支持多种格式：sk-xxx, Bearer xxx 等
 */
export function validateApiKey(key) {
  if (!key || key.trim().length === 0) {
    return { valid: false, message: '请输入 API Key' }
  }
  // 去掉 Bearer 前缀
  const cleaned = key.replace(/^Bearer\s+/i, '').trim()
  if (cleaned.length < 8) {
    return { valid: false, message: 'API Key 格式不正确，长度过短' }
  }
  return { valid: true, cleaned }
}

/**
 * 清除字符串内存（尽力而为，JS 无法保证）
 * 将字符串变量置空并触发垃圾回收提示
 */
export function clearSensitiveData(setter) {
  setter('')
}

/**
 * 安全 HTTP headers，不缓存敏感请求
 */
export function getSecureHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
  }
}

/**
 * 创建安全的请求体（不暴露完整 key 到控制台）
 */
export function safeLog(message, data) {
  if (process.env.NODE_ENV === 'development') {
    // 开发环境也不打印 key
    const safe = { ...data }
    if (safe.apiKey) safe.apiKey = maskApiKey(safe.apiKey)
    if (safe.api_key) safe.api_key = maskApiKey(safe.api_key)
    console.log(message, safe)
  }
}

/**
 * 安全策略常量
 */
export const SECURITY_CONFIG = {
  // 不自动填充
  autoComplete: 'new-password',
  // 输入类型
  inputType: 'password',
  // 空闲超时清除（毫秒） - 5分钟
  idleTimeout: 5 * 60 * 1000,
  // 是否在页面隐藏时清除
  clearOnHide: false,
  // 是否在页面关闭时清除（默认行为，state 自动销毁）
  clearOnUnload: true,
}
