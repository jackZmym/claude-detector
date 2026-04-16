'use client'

import { useState, useMemo } from 'react'

/**
 * 调用日志明细表格
 */
export default function LogsTable({ logs, stats }) {
  const [sortField, setSortField] = useState('timestamp')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [filterModel, setFilterModel] = useState('')
  const pageSize = 15

  // 排序
  const sorted = useMemo(() => {
    if (!logs) return []
    return [...logs].sort((a, b) => {
      const av = a[sortField]
      const bv = b[sortField]
      if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
  }, [logs, sortField, sortDir])

  // 过滤
  const filtered = useMemo(() => {
    if (!filterModel) return sorted
    return sorted.filter((l) => l.model.toLowerCase().includes(filterModel.toLowerCase()))
  }, [sorted, filterModel])

  // 分页
  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const SortIcon = ({ field }) => (
    <span className="ml-1 text-gray-600">
      {sortField === field ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  )

  const getTimeColor = (sec) => {
    if (sec < 10) return 'text-green-400'
    if (sec < 30) return 'text-yellow-400'
    return 'text-red-400'
  }

  // 模型名 -> 颜色
  const getModelColor = (name) => {
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    const colors = [
      'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'bg-green-500/20 text-green-400 border-green-500/30',
      'bg-orange-500/20 text-orange-400 border-orange-500/30',
      'bg-pink-500/20 text-pink-400 border-pink-500/30',
      'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    ]
    return colors[Math.abs(hash) % colors.length]
  }

  // 导出 CSV
  const exportCSV = () => {
    if (!logs || logs.length === 0) return
    const header = '时间,令牌名,模型,用时(s),流式,Prompt Tokens,Completion Tokens,花费\n'
    const rows = logs.map((l) =>
      `"${l.time}","${l.tokenName}","${l.model}",${l.useTime},${l.isStream ? '是' : '否'},${l.promptTokens},${l.completionTokens},"${l.cost}"`
    ).join('\n')
    const blob = new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `api-logs-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="glass-card p-6 text-center text-gray-500 text-sm">
        暂无调用日志
      </div>
    )
  }

  return (
    <div className="space-y-4 fade-in">
      {/* 统计概览 */}
      {stats && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              调用统计
            </h3>
            <button
              onClick={exportCSV}
              className="text-xs text-gray-500 hover:text-green-400 transition-colors flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              导出 CSV
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">总调用</p>
              <p className="text-lg font-bold text-white">{logs.length}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">总花费</p>
              <p className="text-lg font-bold text-orange-400">{stats.totalCost}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">总 Tokens</p>
              <p className="text-lg font-bold text-blue-400">{stats.totalTokens.toLocaleString()}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">模型数</p>
              <p className="text-lg font-bold text-purple-400">{Object.keys(stats.modelStats).length}</p>
            </div>
          </div>

          {/* 模型使用分布 */}
          {Object.keys(stats.modelStats).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(stats.modelStats)
                .sort((a, b) => b[1].count - a[1].count)
                .map(([model, s]) => (
                  <span
                    key={model}
                    className={`px-2 py-1 text-xs rounded-md border cursor-pointer ${getModelColor(model)}`}
                    onClick={() => setFilterModel(filterModel === model ? '' : model)}
                    title={`${s.count} 次调用，花费 ${s.costDisplay}`}
                  >
                    {model} ({s.count})
                  </span>
                ))}
            </div>
          )}
        </div>
      )}

      {/* 过滤栏 */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={filterModel}
          onChange={(e) => { setFilterModel(e.target.value); setPage(1) }}
          placeholder="按模型名过滤..."
          className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
        />
        {filterModel && (
          <button
            onClick={() => setFilterModel('')}
            className="text-xs text-gray-500 hover:text-white px-2 py-2"
          >
            清除
          </button>
        )}
        <span className="text-xs text-gray-500">{filtered.length} 条</span>
      </div>

      {/* 表格 */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700/50">
                {[
                  { key: 'timestamp', label: '时间' },
                  { key: 'model', label: '模型' },
                  { key: 'useTime', label: '用时(s)' },
                  { key: 'promptTokens', label: 'Prompt' },
                  { key: 'completionTokens', label: 'Completion' },
                  { key: 'quota', label: '花费' },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-400 cursor-pointer hover:text-white whitespace-nowrap"
                  >
                    {col.label}<SortIcon field={col.key} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((log, i) => (
                <tr key={log.id || i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">{log.time}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 text-xs rounded border ${getModelColor(log.model)}`}>
                      {log.model}
                    </span>
                  </td>
                  <td className={`px-4 py-2.5 text-xs font-mono ${getTimeColor(log.useTime)}`}>
                    {log.useTime}s
                    {log.isStream && <span className="ml-1 text-gray-600">(流)</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">{log.promptTokens.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">{log.completionTokens.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-xs text-orange-400 font-mono">{log.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700/50">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="text-xs text-gray-400 hover:text-white disabled:opacity-30 px-3 py-1 rounded bg-gray-800"
            >
              上一页
            </button>
            <span className="text-xs text-gray-500">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="text-xs text-gray-400 hover:text-white disabled:opacity-30 px-3 py-1 rounded bg-gray-800"
            >
              下一页
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
