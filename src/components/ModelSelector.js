'use client'

import { useState } from 'react'

/**
 * 模型选择器组件
 * 支持两种模式：
 * 1. 从中转站拉取模型列表，下拉选择
 * 2. 手动输入自定义模型名（适配别名）
 */
export default function ModelSelector({ 
  baseUrl, 
  apiKey, 
  selectedModel, 
  onModelChange 
}) {
  const [mode, setMode] = useState('auto') // 'auto' | 'manual'
  const [loading, setLoading] = useState(false)
  const [claudeModels, setClaudeModels] = useState([])
  const [otherModels, setOtherModels] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [error, setError] = useState('')
  const [fetched, setFetched] = useState(false)
  const [showOther, setShowOther] = useState(false)

  const fetchModels = async () => {
    if (!baseUrl || !apiKey) {
      setError('请先填写 Base URL 和 API Key')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl, apiKey }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '获取模型列表失败')
        return
      }

      setClaudeModels(data.claudeModels || [])
      setOtherModels(data.otherModels || [])
      setTotalCount(data.total || 0)
      setFetched(true)

      // 自动选中第一个 Claude 模型
      if (data.claudeModels?.length > 0) {
        onModelChange(data.claudeModels[0].id)
      }
    } catch (err) {
      setError(`请求失败: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* 模式切换 */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-300 font-medium">模型选择</label>
        <div className="flex bg-gray-800 rounded-lg p-0.5 ml-auto">
          <button
            type="button"
            onClick={() => setMode('auto')}
            className={`px-3 py-1 text-xs rounded-md transition-all ${
              mode === 'auto'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            自动获取
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`px-3 py-1 text-xs rounded-md transition-all ${
              mode === 'manual'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            手动输入
          </button>
        </div>
      </div>

      {mode === 'auto' ? (
        <div className="space-y-2">
          {/* 获取按钮 */}
          <button
            type="button"
            onClick={fetchModels}
            disabled={loading}
            className="w-full py-2 px-4 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-300 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                获取中...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                从中转站获取模型列表
              </>
            )}
          </button>

          {/* 错误提示 */}
          {error && (
            <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>
          )}

          {/* 模型列表 */}
          {fetched && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">
                共找到 {totalCount} 个模型，其中 {claudeModels.length} 个疑似 Claude
              </p>

              {/* Claude 模型 */}
              {claudeModels.length > 0 && (
                <div>
                  <p className="text-xs text-green-400 mb-1">Claude 模型:</p>
                  <select
                    value={selectedModel}
                    onChange={(e) => onModelChange(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    {claudeModels.map((m) => (
                      <option key={m.id} value={m.id}>{m.id}</option>
                    ))}
                  </select>
                </div>
              )}

              {claudeModels.length === 0 && (
                <p className="text-xs text-yellow-400 bg-yellow-400/10 px-3 py-2 rounded-lg">
                  未找到 Claude 相关模型名。可能使用了别名，请切换到「手动输入」模式
                </p>
              )}

              {/* 其他模型（可展开） */}
              {otherModels.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowOther(!showOther)}
                    className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
                  >
                    <svg className={`w-3 h-3 transition-transform ${showOther ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                      <path d="M6 6L14 10L6 14V6Z" />
                    </svg>
                    其他 {otherModels.length} 个模型
                  </button>
                  {showOther && (
                    <select
                      value={selectedModel}
                      onChange={(e) => onModelChange(e.target.value)}
                      className="w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                    >
                      <option value="">-- 选择其他模型 --</option>
                      {otherModels.map((m) => (
                        <option key={m.id} value={m.id}>{m.id}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* 手动输入模式 */
        <div className="space-y-2">
          <input
            type="text"
            value={selectedModel}
            onChange={(e) => onModelChange(e.target.value)}
            placeholder="输入模型名称，如: claude-sonnet-4-20250514, my-claude-alias"
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500"
          />
          <p className="text-xs text-gray-500">
            提示：输入中转站分配的模型名称或别名，支持官方名和任何自定义映射
          </p>

          {/* 常用 Claude 模型快捷选择 */}
          <p className="text-xs text-gray-600">官方模型名:</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              'claude-opus-4-20250514',
              'claude-sonnet-4-20250514',
              'claude-sonnet-4-5-20250514',
              'claude-3-7-sonnet-20250219',
              'claude-3-5-sonnet-20241022',
              'claude-3-5-haiku-20241022',
            ].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onModelChange(m)}
                className={`px-2 py-1 text-xs rounded-md border transition-all ${
                  selectedModel === m
                    ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          {/* 常见别名/短名 */}
          <p className="text-xs text-gray-600 mt-2">常见别名（部分中转站使用）:</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              'claude-4-opus',
              'claude-4-sonnet',
              'claude-4.5-sonnet',
              'claude-3.7-sonnet',
              'claude-3.5-sonnet',
              'claude-3.5-haiku',
            ].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onModelChange(m)}
                className={`px-2 py-1 text-xs rounded-md border transition-all ${
                  selectedModel === m
                    ? 'bg-purple-600/20 border-purple-500 text-purple-400'
                    : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-500'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-2">
            注意：部分平台（如 aicodewith.com）区分 CLI 和 API 端点，请使用对应端点的模型名
          </p>
        </div>
      )}
    </div>
  )
}
