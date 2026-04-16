import { NextResponse } from 'next/server'

/**
 * 查询令牌调用日志明细
 * 调用 NewAPI 的 /api/log/token 接口
 */
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
    // 这个接口不走 /v1 前缀
    url = url.replace(/\/v1$/, '')

    const res = await fetch(`${url}/api/log/token?key=${encodeURIComponent(apiKey)}`)

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json(
        { error: `查询日志失败: ${res.status} - ${errText}` },
        { status: res.status }
      )
    }

    const data = await res.json()

    if (!data.success) {
      return NextResponse.json(
        { error: data.message || '查询失败' },
        { status: 400 }
      )
    }

    // 格式化日志数据
    const logs = (data.data || []).map((log) => ({
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
      // quota / 500000 = 美元
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

    // 转换 modelStats 的 cost 为美元
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
