'use client'

/**
 * 检测进度条组件
 */
export default function ProgressBar({ current, total, currentTest }) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 pulse-dot" />
          <span className="text-sm text-gray-300">检测进行中</span>
        </div>
        <span className="text-sm text-gray-400">{current} / {total}</span>
      </div>
      
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      
      {currentTest && (
        <p className="text-xs text-gray-500">
          正在执行: {currentTest}
        </p>
      )}
    </div>
  )
}
