import { NextResponse } from 'next/server'

// 安全：禁止缓存此路由
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

/**
 * 核心检测 API
 * 
 * 安全策略：
 * - API Key 仅在请求处理期间存在于内存，处理完毕后不保留
 * - 不记录 API Key 到任何日志
 * - 响应头禁止缓存
 */
export async function POST(request) {
  let apiKey = null
  try {
    const body = await request.json()
    const { baseUrl, model, tests } = body
    apiKey = body.apiKey

    if (!baseUrl || !apiKey || !model) {
      return NextResponse.json(
        { error: '请提供 Base URL、API Key 和模型名称' },
        { status: 400 }
      )
    }

    // 规范化 baseUrl
    let url = baseUrl.replace(/\/+$/, '')
    if (!url.endsWith('/v1')) {
      url += '/v1'
    }

    const results = []
    const startTime = Date.now()

    for (const test of tests) {
      const testStart = Date.now()

      try {
        const response = await fetch(`${url}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            messages: test.messages,
            max_tokens: 1024,
            temperature: 0.3,
          }),
        })

        if (!response.ok) {
          const errText = await response.text()
          results.push({
            name: test.name,
            description: test.description,
            score: 0,
            details: [`❌ API 请求失败: ${response.status} - ${errText}`],
            rawResponse: errText,
            latency: Date.now() - testStart,
            error: true,
          })
          continue
        }

        const data = await response.json()
        const content = data.choices?.[0]?.message?.content || ''
        const usage = data.usage || {}
        const responseModel = data.model || ''

        // 额外信息：检测返回的 model 字段
        const modelMismatch = responseModel && 
          responseModel.toLowerCase() !== model.toLowerCase() &&
          !responseModel.toLowerCase().includes('claude')

        const result = {
          name: test.name,
          description: test.description,
          rawResponse: content,
          latency: Date.now() - testStart,
          usage,
          responseModel,
          modelMismatch,
          error: false,
        }

        results.push(result)
      } catch (err) {
        results.push({
          name: test.name,
          description: test.description,
          score: 0,
          details: [`❌ 请求异常: ${err.message}`],
          rawResponse: '',
          latency: Date.now() - testStart,
          error: true,
        })
      }
    }

    const totalLatency = Date.now() - startTime

    // 检测额外信号
    const extraSignals = []
    
    // 检查响应中的 model 字段
    const responseModels = results
      .filter(r => r.responseModel)
      .map(r => r.responseModel)
    
    if (responseModels.length > 0) {
      const uniqueModels = [...new Set(responseModels)]
      if (uniqueModels.some(m => !m.toLowerCase().includes('claude'))) {
        extraSignals.push({
          type: 'warning',
          message: `API 返回的 model 字段为 "${uniqueModels.join(', ')}"，可能非 Claude 模型`,
        })
      }
      if (uniqueModels.length > 1) {
        extraSignals.push({
          type: 'warning', 
          message: `多次请求返回了不同的 model 名称，中转站可能做了负载均衡`,
        })
      }
    }

    // 检查平均延迟
    const avgLatency = results.reduce((a, r) => a + r.latency, 0) / results.length
    if (avgLatency > 10000) {
      extraSignals.push({
        type: 'info',
        message: `平均响应延迟 ${Math.round(avgLatency)}ms，延迟较高`,
      })
    }

    return NextResponse.json({
      results,
      totalLatency,
      extraSignals,
      requestedModel: model,
    })
  } catch (error) {
    return NextResponse.json(
      { error: `检测失败: ${error.message}` },
      { status: 500 }
    )
  }
}
