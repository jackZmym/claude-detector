'use client'

/**
 * 圆形评分环组件
 * 用于展示总体检测评分
 */
export default function ScoreRing({ score, size = 160, strokeWidth = 10 }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  const getColor = (s) => {
    if (s >= 85) return '#22c55e'
    if (s >= 65) return '#eab308'
    if (s >= 40) return '#f97316'
    return '#ef4444'
  }

  const color = getColor(score)

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* 背景环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#2a2a4a"
          strokeWidth={strokeWidth}
        />
        {/* 分数环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="score-ring transition-all duration-1000"
          style={{ '--score-offset': offset }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-bold" style={{ color }}>
          {score}
        </span>
        <span className="text-xs text-gray-400 mt-1">/ 100</span>
      </div>
    </div>
  )
}
