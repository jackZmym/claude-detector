'use client'

import { useState } from 'react'

/**
 * 单个测试结果卡片
 */
export default function TestCard({ result, index }) {
  const [expanded, setExpanded] = useState(false)

  const getScoreColor = (s) => {
    if (s >= 80) return 'text-green-400'
    if (s >= 60) return 'text-yellow-400'
    if (s >= 40) return 'text-orange-400'
    return 'text-red-400'
  }

  const getScoreBg = (s) => {
    if (s >= 80) return 'bg-green-400/10 border-green-400/30'
    if (s >= 60) return 'bg-yellow-400/10 border-yellow-400/30'
    if (s >= 40) return 'bg-orange-400/10 border-orange-400/30'
    return 'bg-red-400/10 border-red-400/30'
  }

  const getBarWidth = (s) => `${s}%`

  return (
    <div
      className="glass-card p-5 fade-in cursor-pointer hover:border-blue-500/30 transition-all"
      style={{ animationDelay: `${index * 100}ms` }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold border ${getScoreBg(result.score)}`}>
            <span className={getScoreColor(result.score)}>{result.score}</span>
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">{result.name}</h3>
            <p className="text-xs text-gray-500">{result.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{result.latency}ms</span>
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* 分数条 */}
      <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            width: getBarWidth(result.score),
            background: result.score >= 80 ? '#22c55e' : result.score >= 60 ? '#eab308' : result.score >= 40 ? '#f97316' : '#ef4444',
          }}
        />
      </div>

      {/* 详情 */}
      <div className="space-y-1">
        {result.details?.map((detail, i) => (
          <p key={i} className="text-xs text-gray-400">{detail}</p>
        ))}
      </div>

      {/* 模型返回信息 */}
      {result.modelMismatch && (
        <div className="mt-2 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-xs text-red-400">
            ⚠ API 返回模型: {result.responseModel}（与请求模型不一致）
          </p>
        </div>
      )}

      {/* 展开的原始回复 */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-700/50">
          <p className="text-xs text-gray-500 mb-2">原始回复:</p>
          <pre className="text-xs text-gray-400 bg-black/30 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap max-h-60 overflow-y-auto">
            {result.rawResponse || '（无内容）'}
          </pre>
          {result.usage && (result.usage.prompt_tokens || result.usage.completion_tokens) && (
            <div className="flex gap-4 mt-2">
              <span className="text-xs text-gray-500">
                Prompt tokens: {result.usage.prompt_tokens || 0}
              </span>
              <span className="text-xs text-gray-500">
                Completion tokens: {result.usage.completion_tokens || 0}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
