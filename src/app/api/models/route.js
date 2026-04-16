import { NextResponse } from 'next/server'

/**
 * 获取中转站的模型列表
 * 调用 /v1/models 接口，过滤出 Claude 相关模型
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

    // 规范化 baseUrl
    let url = baseUrl.replace(/\/+$/, '')
    if (!url.endsWith('/v1')) {
      url += '/v1'
    }

    const response = await fetch(`${url}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errText = await response.text()
      return NextResponse.json(
        { error: `获取模型列表失败: ${response.status} - ${errText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    const models = data.data || data || []

    // 过滤出可能是 Claude 的模型（宽松匹配，覆盖 claude-4/opus-4/sonnet-4 等新命名）
    const claudeKeywords = ['claude', 'anthropic', 'sonnet', 'opus', 'haiku', 'claude-4', 'claude-3']
    
    const allModels = Array.isArray(models)
      ? models.map(m => ({
          id: m.id || m.name || m,
          name: m.id || m.name || m,
        }))
      : []

    const claudeModels = allModels.filter(m => 
      claudeKeywords.some(k => m.id.toLowerCase().includes(k))
    )

    const otherModels = allModels.filter(m =>
      !claudeKeywords.some(k => m.id.toLowerCase().includes(k))
    )

    return NextResponse.json({
      claudeModels,
      otherModels,
      total: allModels.length,
    })
  } catch (error) {
    return NextResponse.json(
      { error: `请求失败: ${error.message}` },
      { status: 500 }
    )
  }
}
