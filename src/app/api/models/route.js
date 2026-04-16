import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

/**
 * 获取中转站的模型列表 v2.1
 * 
 * 优化：
 * 1. 更完善的 Claude 模型匹配（覆盖别名、短名、平台自定义名等）
 * 2. 按模型系列分组排序
 * 3. 超时控制
 * 4. 错误信息更友好
 */

const REQUEST_TIMEOUT = 10000

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
    if (!url.endsWith('/v1')) {
      url += '/v1'
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

    try {
      const response = await fetch(`${url}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (!response.ok) {
        const errText = await response.text()
        
        // 针对常见错误给出具体提示
        if (response.status === 401 || response.status === 403) {
          return NextResponse.json(
            { error: 'API Key 无效或无权限获取模型列表' },
            { status: response.status }
          )
        }
        
        return NextResponse.json(
          { error: `获取模型列表失败: ${response.status} - ${errText.substring(0, 200)}` },
          { status: response.status }
        )
      }

      const data = await response.json()
      const models = data.data || data || []

      // 更全面的 Claude 模型关键词匹配
      const claudeKeywords = [
        'claude', 'anthropic', 'sonnet', 'opus', 'haiku',
        'claude-4', 'claude-3', 'claude-2',
      ]
      
      // 排除误匹配（某些模型名可能碰巧包含关键词）
      const excludePatterns = [
        /^(?!.*claude).*opus$/i,  // 不包含 claude 但包含 opus 的（如音乐模型）
      ]
      
      const allModels = Array.isArray(models)
        ? models.map(m => ({
            id: m.id || m.name || m,
            name: m.id || m.name || m,
            created: m.created || 0,
          }))
        : []

      const claudeModels = allModels
        .filter(m => {
          const id = m.id.toLowerCase()
          const isMatch = claudeKeywords.some(k => id.includes(k))
          const isExcluded = excludePatterns.some(p => p.test(id))
          return isMatch && !isExcluded
        })
        .sort((a, b) => {
          // 按版本排序：claude-4 > claude-3.7 > claude-3.5 > claude-3
          const order = (id) => {
            if (id.includes('opus-4') || id.includes('claude-4-opus')) return 10
            if (id.includes('sonnet-4-5') || id.includes('4.5-sonnet')) return 9
            if (id.includes('sonnet-4') || id.includes('claude-4-sonnet')) return 8
            if (id.includes('3-7') || id.includes('3.7')) return 7
            if (id.includes('3-5') || id.includes('3.5')) return 6
            if (id.includes('haiku')) return 5
            return 0
          }
          return order(b.id.toLowerCase()) - order(a.id.toLowerCase())
        })

      const otherModels = allModels.filter(m =>
        !claudeKeywords.some(k => m.id.toLowerCase().includes(k))
      )

      return NextResponse.json({
        claudeModels,
        otherModels,
        total: allModels.length,
      })
    } catch (err) {
      clearTimeout(timer)
      if (err.name === 'AbortError') {
        return NextResponse.json(
          { error: '获取模型列表超时，请检查 Base URL 是否正确' },
          { status: 408 }
        )
      }
      throw err
    }
  } catch (error) {
    return NextResponse.json(
      { error: `请求失败: ${error.message}` },
      { status: 500 }
    )
  }
}
