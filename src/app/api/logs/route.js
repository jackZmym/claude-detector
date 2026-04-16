import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

/**
 * 查询令牌调用日志明细 v2.1
 * 
 * 尝试多种日志接口：
 * 1. NewAPI/OneAPI: /api/log/token?key=xxx
 * 2. NewAPI 备用: /api/log/self（部分版本）
 * 
 * 对于不支持日志查询的平台（如 aicodewith.com、apertis.ai 等），
 * 返回明确的 "不支持" 提示而非报错。
 */

const REQUEST_TIMEOUT = 10000

async function fetchWithTimeout(url, options, timeout = REQUEST_TIMEOUT) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    return response
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('请求超时')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export async function POST(request) {
  try {
    const { baseUrl, apiKey } = await request.json()

    if (!baseUrl || !apiKey) {
      return NextResponse.json(
        { error: '请提供 Base URL 和 API Key' },
        { status: 400 }
      )
    }

    let url = baseUrl.replace(/\/+$/, '')
    // 日志接口不走 /v1 前缀
    url = url.replace(/\/v1$/, '')

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }

    // 尝试 NewAPI /api/log/token
    let data = null
    let supported = false

    try {
      const res = await fetchWithTimeout(
        `${url}/api/log/token?key=${encodeURIComponent(apiKey)}`,
        { headers }
      )

      if (res.ok) {
        const json = await res.json()
        if (json.success !== false && (json.data || Array.isArray(json))) {
          data = json
          supported = true
        }
      } else if (res.status === 401 || res.status === 403) {
        return NextResponse.json(
          { error: 'API Key 无效或无权限查询日志' },
          { status: res.status }
        )
      }
      // 404/400/其他 → 平台不支持，不报错
    } catch {
      // 超时或网络错误，继续
    }

    // 如果第一个接口不支持，尝试 /api/log/self
    if (!supported) {
      try {
        const res = await fetchWithTimeout(
          `${url}/api/log/self`,
          { headers }
        )

        if (res.ok) {
          const json = await res.json()
          if (json.success !== false && (json.data || Array.isArray(json))) {
            data = json
            supported = true
          }
        }
      } catch {
        // 忽略
      }
    }

    // 平台不支持日志查询
    if (!supported) {
      return NextResponse.json({
        logs: [],
        total: 0,
        stats: null,
        unsupported: true,
        message: '该平台不支持调用日志查询（仅 NewAPI/OneAPI 兼容站支持此功能）',
      })
    }

    // 格式化日志数据
    const rawLogs = data.data || data || []
    const logs = (Array.isArray(rawLogs) ? rawLogs : []).map((log) => ({
      id: log.id,
      time: log.created_at
        ? new Date(log.created_at * 1000).toLocaleString('zh-CN')
        : '',
      timestamp: log.created_at || 0,
      tokenName: log.token_name || '',
      model: log.model_name || '',
      useTime: log.use_time || 0,
      isStream: log.is_stream || false,
      promptTokens: log.prompt_tokens || 0,
      completionTokens: log.completion_tokens || 0,
      quota: log.quota || 0,
      cost: `$${(log.quota / 500000).toFixed(6)}`,
      content: log.content || '',
    }))

    // 统计信息
    const totalCost = logs.reduce((s, l) => s + l.quota, 0)
    const totalPrompt = logs.reduce((s, l) => s + l.promptTokens, 0)
    const totalCompletion = logs.reduce((s, l) => s + l.completionTokens, 0)
    const modelStats = {}
    logs.forEach((l) => {
      if (!modelStats[l.model]) {
        modelStats[l.model] = { count: 0, cost: 0 }
      }
      modelStats[l.model].count++
      modelStats[l.model].cost += l.quota
    })

    Object.keys(modelStats).forEach((k) => {
      modelStats[k].costDisplay = `$${(modelStats[k].cost / 500000).toFixed(4)}`
    })

    return NextResponse.json({
      logs,
      total: logs.length,
      stats: {
        totalCost: `$${(totalCost / 500000).toFixed(4)}`,
        totalPromptTokens: totalPrompt,
        totalCompletionTokens: totalCompletion,
        totalTokens: totalPrompt + totalCompletion,
        modelStats,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: `请求失败: ${error.message}` },
      { status: 500 }
    )
  }
}
