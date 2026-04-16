'use client'

/**
 * 余额信息面板 v2.1
 * 
 * 兼容两种模式：
 * 1. 标准模式 - 显示完整的额度/已用/剩余
 * 2. 降级模式 - 平台不支持余额查询时，显示 Key 有效性和可用模型
 */
export default function BalanceCard({ balance, onCopy }) {
  if (!balance) return null

  // 判断是否为降级模式（平台不支持余额查询）
  const isDegraded = balance.platformNote || balance.totalRaw === -1

  const getUsageColor = (pct) => {
    if (pct >= 90) return 'bg-red-500'
    if (pct >= 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const copyInfo = () => {
    const text = isDegraded
      ? [
          `平台说明：${balance.platformNote || '不支持余额查询'}`,
          `API Key 有效：${balance.keyValid ? '是' : '否'}`,
          `可用模型数：${balance.availableModels || '未知'}`,
          `Claude 模型数：${balance.claudeModelCount || '未知'}`,
          balance.claudeModelNames?.length > 0 ? `Claude 模型：${balance.claudeModelNames.join(', ')}` : '',
        ].filter(Boolean).join('\n')
      : [
          `令牌总额：${balance.total}`,
          `已用额度：${balance.used}`,
          `剩余额度：${balance.remaining}`,
          `有效期至：${balance.accessUntil}`,
        ].join('\n')
    navigator.clipboard.writeText(text)
    onCopy?.()
  }

  // ==================== 降级模式展示 ====================
  if (isDegraded) {
    return (
      <div className="glass-card p-6 fade-in space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            连接信息
          </h3>
          <button
            onClick={copyInfo}
            className="text-xs text-gray-500 hover:text-blue-400 transition-colors flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            复制
          </button>
        </div>

        {/* 平台提示 */}
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3 space-y-2">
          {balance.platformName && (
            <p className="text-xs text-yellow-300 font-medium">
              已识别平台: {balance.platformName}
            </p>
          )}
          <p className="text-xs text-yellow-400">
            {balance.platformNote || '该平台不支持通过 API Key 查询余额'}
          </p>
          {balance.billingModel && (
            <p className="text-xs text-gray-400">
              计费模式: {balance.billingModel}
            </p>
          )}
          {balance.consoleUrl ? (
            <a
              href={balance.consoleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              前往控制台查看余额
            </a>
          ) : (
            <p className="text-xs text-gray-500">
              请在平台控制台直接查看余额和用量
            </p>
          )}
        </div>

        {/* 连接状态 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">API Key 状态</p>
            <p className={`text-lg font-bold ${balance.keyValid ? 'text-green-400' : 'text-red-400'}`}>
              {balance.keyValid ? '有效' : '无效'}
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">可用模型数</p>
            <p className="text-lg font-bold text-white">
              {balance.availableModels || '未知'}
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 col-span-2">
            <p className="text-xs text-gray-500 mb-1">Claude 模型 ({balance.claudeModelCount || 0} 个)</p>
            {balance.claudeModelNames?.length > 0 ? (
              <div className="flex flex-wrap gap-1 mt-1">
                {balance.claudeModelNames.map((name, i) => (
                  <span key={i} className="text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                    {name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">未发现 Claude 模型</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ==================== 标准模式展示 ====================
  return (
    <div className="glass-card p-6 fade-in space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          额度信息
        </h3>
        <button
          onClick={copyInfo}
          className="text-xs text-gray-500 hover:text-blue-400 transition-colors flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          复制
        </button>
      </div>

      {/* 使用量进度条 */}
      {!balance.isUnlimited && balance.usagePercent >= 0 && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>使用进度</span>
            <span>{balance.usagePercent.toFixed(1)}%</span>
          </div>
          <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${getUsageColor(balance.usagePercent)}`}
              style={{ width: `${Math.min(100, balance.usagePercent)}%` }}
            />
          </div>
        </div>
      )}

      {/* 额度详情 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">总额度</p>
          <p className="text-lg font-bold text-white">
            {balance.isUnlimited ? (
              <span className="text-purple-400">无限</span>
            ) : balance.total}
          </p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">已用</p>
          <p className="text-lg font-bold text-orange-400">{balance.used}</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">剩余</p>
          <p className="text-lg font-bold text-green-400">
            {balance.isUnlimited ? (
              <span className="text-purple-400">无限</span>
            ) : balance.remaining}
          </p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">有效期至</p>
          <p className="text-sm font-medium text-gray-300">{balance.accessUntil}</p>
        </div>
      </div>
    </div>
  )
}
