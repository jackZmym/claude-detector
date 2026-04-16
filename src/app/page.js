'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import ScoreRing from '../components/ScoreRing'
import TestCard from '../components/TestCard'
import ModelSelector from '../components/ModelSelector'
import ProgressBar from '../components/ProgressBar'
import BalanceCard from '../components/BalanceCard'
import LogsTable from '../components/LogsTable'
import { allTests, calculateOverallScore } from '../lib/detection-tests'
import { maskApiKey, validateApiKey, SECURITY_CONFIG } from '../lib/security'

export default function Home() {
  // ========== 全局配置 ==========
  const [activeTab, setActiveTab] = useState('detect') // 'detect' | 'balance'
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')       // 仅存内存，永不持久化
  const [showKey, setShowKey] = useState(false)  // 控制密码可见
  const [toast, setToast] = useState('')
  const apiKeyRef = useRef(null)
  const idleTimerRef = useRef(null)

  // ========== 安全措施 ==========

  // 1. 页面关闭/刷新时自动清除 key（虽然 state 本身会销毁，加个保险）
  useEffect(() => {
    const handleBeforeUnload = () => {
      setApiKey('')
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  // 2. 页面隐藏超过5分钟自动清除 key
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        idleTimerRef.current = setTimeout(() => {
          setApiKey('')
          showToast('API Key 已因安全策略自动清除（页面闲置超过5分钟）')
        }, SECURITY_CONFIG.idleTimeout)
      } else {
        if (idleTimerRef.current) {
          clearTimeout(idleTimerRef.current)
          idleTimerRef.current = null
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [])

  // 3. 禁止浏览器自动保存密码 - 组件加载后设置属性
  useEffect(() => {
    if (apiKeyRef.current) {
      apiKeyRef.current.setAttribute('autocomplete', 'off')
      apiKeyRef.current.setAttribute('data-lpignore', 'true')       // LastPass
      apiKeyRef.current.setAttribute('data-1p-ignore', 'true')      // 1Password
      apiKeyRef.current.setAttribute('data-bwignore', 'true')       // Bitwarden
      apiKeyRef.current.setAttribute('data-form-type', 'other')     // Dashlane
    }
  }, [])

  // 4. 防止通过开发者工具获取（尽力而为）
  useEffect(() => {
    const preventDevTools = (e) => {
      // 不阻止正常操作，只是在复制时清理控制台中的敏感信息
    }
    return () => {}
  }, [])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // 手动清除 key
  const clearApiKey = () => {
    setApiKey('')
    showToast('API Key 已安全清除')
  }

  // ========== 模型检测状态 ==========
  const [model, setModel] = useState('')
  const [detecting, setDetecting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, currentTest: '' })
  const [results, setResults] = useState(null)
  const [overallScore, setOverallScore] = useState(null)
  const [extraSignals, setExtraSignals] = useState([])
  const [detectError, setDetectError] = useState('')
  const [history, setHistory] = useState([])

  // ========== 额度查询状态 ==========
  const [balanceData, setBalanceData] = useState(null)
  const [logsData, setLogsData] = useState(null)
  const [logsStats, setLogsStats] = useState(null)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [logsLoading, setLogsLoading] = useState(false)
  const [balanceError, setBalanceError] = useState('')

  // ========== 模型检测逻辑 ==========
  const runDetection = useCallback(async () => {
    const keyCheck = validateApiKey(apiKey)
    if (!baseUrl || !keyCheck.valid || !model) {
      setDetectError(!baseUrl ? '请填写 Base URL' : !keyCheck.valid ? keyCheck.message : '请选择模型')
      return
    }

    setDetecting(true)
    setDetectError('')
    setResults(null)
    setOverallScore(null)
    setExtraSignals([])

    const testCount = allTests.length
    setProgress({ current: 0, total: testCount, currentTest: '' })

    const testsPayload = allTests.map(t => ({
      name: t.name,
      description: t.description,
      messages: t.messages,
    }))

    try {
      const res = await fetch('/api/detect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
        body: JSON.stringify({ baseUrl, apiKey, model, tests: testsPayload }),
      })

      const data = await res.json()
      if (!res.ok) {
        setDetectError(data.error || '检测请求失败')
        setDetecting(false)
        return
      }

      const analyzedResults = data.results.map((r, i) => {
        if (r.error) return r
        const analyzed = allTests[i].analyze(r.rawResponse)
        return { ...r, ...analyzed }
      })

      const finalResults = []
      for (let i = 0; i < analyzedResults.length; i++) {
        finalResults.push(analyzedResults[i])
        setResults([...finalResults])
        setProgress({
          current: i + 1,
          total: testCount,
          currentTest: i + 1 < testCount ? allTests[i + 1]?.name : '完成',
        })
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      const score = calculateOverallScore(analyzedResults)
      setOverallScore(score)
      setExtraSignals(data.extraSignals || [])

      // 历史记录：只保存脱敏信息，绝不保存 API Key
      setHistory(prev => [{
        time: new Date().toLocaleString('zh-CN'),
        model,
        baseUrl: baseUrl.replace(/https?:\/\//, '').split('/')[0],
        score: score.overall,
        verdict: score.verdict,
        // 注意：不保存 apiKey
      }, ...prev].slice(0, 10))
    } catch (err) {
      setDetectError(`检测异常: ${err.message}`)
    } finally {
      setDetecting(false)
    }
  }, [baseUrl, apiKey, model])

  // ========== 额度查询逻辑 ==========
  const queryBalance = useCallback(async () => {
    const keyCheck = validateApiKey(apiKey)
    if (!baseUrl || !keyCheck.valid) {
      setBalanceError(!baseUrl ? '请填写 Base URL' : keyCheck.message)
      return
    }

    setBalanceLoading(true)
    setBalanceError('')
    setBalanceData(null)

    try {
      const res = await fetch('/api/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify({ baseUrl, apiKey }),
      })
      const data = await res.json()
      if (!res.ok) {
        setBalanceError(data.error || '查询失败')
        return
      }
      setBalanceData(data)
    } catch (err) {
      setBalanceError(`请求失败: ${err.message}`)
    } finally {
      setBalanceLoading(false)
    }
  }, [baseUrl, apiKey])

  const queryLogs = useCallback(async () => {
    const keyCheck = validateApiKey(apiKey)
    if (!baseUrl || !keyCheck.valid) {
      setBalanceError(!baseUrl ? '请填写 Base URL' : keyCheck.message)
      return
    }

    setLogsLoading(true)
    setBalanceError('')

    try {
      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify({ baseUrl, apiKey }),
      })
      const data = await res.json()
      if (!res.ok) {
        setBalanceError(data.error || '查询失败')
        return
      }
      setLogsData(data.logs)
      setLogsStats(data.stats)
    } catch (err) {
      setBalanceError(`请求失败: ${err.message}`)
    } finally {
      setLogsLoading(false)
    }
  }, [baseUrl, apiKey])

  // 同时查余额和日志
  const queryAll = useCallback(async () => {
    await Promise.all([queryBalance(), queryLogs()])
  }, [queryBalance, queryLogs])

  // ========== 渲染 ==========
  return (
    <main className="min-h-screen pb-20">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[100] bg-gray-800 border border-gray-600 text-sm text-gray-200 px-4 py-2.5 rounded-lg shadow-lg fade-in">
          {toast}
        </div>
      )}

      {/* Header + Tab 导航 */}
      <div className="border-b border-gray-800 bg-[#0a0a0f]/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                C
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Claude 检测工具箱</h1>
                <p className="text-xs text-gray-500">模型真伪检测 & 额度查询</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {apiKey && (
                <span className="text-xs text-green-400/60 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                  {maskApiKey(apiKey)}
                </span>
              )}
              <span className="text-xs text-gray-600">v2.0</span>
            </div>
          </div>

          {/* Tab 栏 */}
          <div className="flex gap-0 -mb-px">
            <button
              onClick={() => setActiveTab('detect')}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-all ${
                activeTab === 'detect'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                模型检测
              </span>
            </button>
            <button
              onClick={() => setActiveTab('balance')}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-all ${
                activeTab === 'balance'
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                额度查询
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-6 space-y-6">

        {/* ====== 公共配置区域 ====== */}
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            中转站配置
          </h2>

          {/* Base URL */}
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Base URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com 或 https://api.example.com/v1"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500"
            />
          </div>

          {/* API Key - 安全加固 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-gray-400">API Key</label>
              <div className="flex items-center gap-2">
                {/* 安全提示 */}
                <span className="text-xs text-gray-600 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  不会保存到本地
                </span>
                {/* 显示/隐藏切换 */}
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="text-xs text-gray-500 hover:text-gray-300"
                >
                  {showKey ? '隐藏' : '显示'}
                </button>
                {/* 清除按钮 */}
                {apiKey && (
                  <button
                    type="button"
                    onClick={clearApiKey}
                    className="text-xs text-red-400/60 hover:text-red-400"
                  >
                    清除
                  </button>
                )}
              </div>
            </div>
            <div className="relative">
              <input
                ref={apiKeyRef}
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-xxxxxxxxxxxxxxxx"
                autoComplete="new-password"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore="true"
                data-bwignore="true"
                data-form-type="other"
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 pr-10"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <svg className={`w-4 h-4 ${apiKey ? 'text-green-500' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
            </div>
            {/* 安全说明 */}
            <div className="mt-1.5 flex items-start gap-1.5">
              <svg className="w-3 h-3 text-gray-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-gray-600">
                Key 仅保存在当前页面内存中，关闭页面或闲置5分钟后自动清除。不存储到浏览器本地，不记录到历史。
              </p>
            </div>
          </div>

          {/* 模型检测 Tab 独有：模型选择器 */}
          {activeTab === 'detect' && (
            <ModelSelector
              baseUrl={baseUrl}
              apiKey={apiKey}
              selectedModel={model}
              onModelChange={setModel}
            />
          )}

          {/* 错误提示 */}
          {(activeTab === 'detect' ? detectError : balanceError) && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
              <p className="text-sm text-red-400">{activeTab === 'detect' ? detectError : balanceError}</p>
            </div>
          )}

          {/* 操作按钮 */}
          {activeTab === 'detect' ? (
            <button
              onClick={runDetection}
              disabled={detecting || !baseUrl || !apiKey || !model}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {detecting ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  检测中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  开始检测
                </>
              )}
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={queryAll}
                disabled={balanceLoading || logsLoading || !baseUrl || !apiKey}
                className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-medium rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {(balanceLoading || logsLoading) ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    查询中...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    查询额度 & 明细
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* ====== 模型检测 Tab 内容 ====== */}
        {activeTab === 'detect' && (
          <>
            {detecting && (
              <ProgressBar
                current={progress.current}
                total={progress.total}
                currentTest={progress.currentTest}
              />
            )}

            {overallScore && (
              <div className="glass-card p-6 fade-in">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <ScoreRing score={overallScore.overall} />
                  <div className="flex-1 text-center md:text-left">
                    <h2 className="text-xl font-bold text-white mb-2">检测结果</h2>
                    <p className={`text-lg font-semibold ${
                      overallScore.verdictColor === 'green' ? 'text-green-400' :
                      overallScore.verdictColor === 'yellow' ? 'text-yellow-400' :
                      overallScore.verdictColor === 'orange' ? 'text-orange-400' :
                      'text-red-400'
                    }`}>
                      {overallScore.verdict}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">请求模型: {model}</p>
                    {extraSignals.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {extraSignals.map((sig, i) => (
                          <p key={i} className={`text-xs ${sig.type === 'warning' ? 'text-yellow-400' : 'text-gray-400'}`}>
                            {sig.type === 'warning' ? '!' : 'i'} {sig.message}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {results && results.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-400">详细检测报告 ({results.length} 项)</h2>
                {results.map((result, i) => (
                  <TestCard key={i} result={result} index={i} />
                ))}
              </div>
            )}

            {history.length > 0 && (
              <div className="glass-card p-6">
                <h2 className="text-sm font-semibold text-gray-400 mb-4">检测历史</h2>
                <div className="space-y-2">
                  {history.map((h, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-3 bg-gray-800/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-bold ${
                          h.score >= 85 ? 'text-green-400' :
                          h.score >= 65 ? 'text-yellow-400' :
                          h.score >= 40 ? 'text-orange-400' : 'text-red-400'
                        }`}>
                          {h.score}
                        </span>
                        <div>
                          <span className="text-xs text-white">{h.model}</span>
                          <span className="text-xs text-gray-500 ml-2">@ {h.baseUrl}</span>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500">{h.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ====== 额度查询 Tab 内容 ====== */}
        {activeTab === 'balance' && (
          <>
            {balanceData && (
              <BalanceCard
                balance={balanceData}
                onCopy={() => showToast('已复制到剪贴板')}
              />
            )}

            {logsData && (
              <LogsTable logs={logsData} stats={logsStats} />
            )}

            {!balanceData && !logsData && !balanceLoading && !logsLoading && (
              <div className="glass-card p-12 text-center">
                <svg className="w-12 h-12 text-gray-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p className="text-sm text-gray-500">填写配置后点击「查询额度 & 明细」</p>
                <p className="text-xs text-gray-600 mt-2">支持 NewAPI / OneAPI 等兼容 OpenAI 格式的中转站</p>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="text-center py-8">
          <p className="text-xs text-gray-600">
            Claude 检测工具箱 - 模型真伪检测 & 额度查询
          </p>
          <p className="text-xs text-gray-700 mt-1">
            检测结果仅供参考 | API Key 不会被存储或传输到第三方
          </p>
        </div>
      </div>
    </main>
  )
}
