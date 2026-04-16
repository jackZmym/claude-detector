'use client'

/**
 * 余额信息面板
 */
export default function BalanceCard({ balance, onCopy }) {
  if (!balance) return null

  const getUsageColor = (pct) => {
    if (pct >= 90) return 'bg-red-500'
    if (pct >= 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const copyInfo = () => {
    const text = [
      `令牌总额：${balance.total}`,
      `已用额度：${balance.used}`,
      `剩余额度：${balance.remaining}`,
      `有效期至：${balance.accessUntil}`,
    ].join('\n')
    navigator.clipboard.writeText(text)
    onCopy?.()
  }

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
      {!balance.isUnlimited && (
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
