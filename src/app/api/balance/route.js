import { NextResponse } from 'next/server'

/**
 * 查询令牌余额
 * 调用 NewAPI/OneAPI 的 /v1/dashboard/billing/subscription 和 /v1/dashboard/billing/usage
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
    if (!url.endsWith('/v1')) {
      url += '/v1'
    }

    // 1. 查询订阅信息（总额度）
    const subRes = await fetch(`${url}/dashboard/billing/subscription`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })

    if (!subRes.ok) {
      const errText = await subRes.text()
      return NextResponse.json(
        { error: `查询订阅信息失败: ${subRes.status} - ${errText}` },
        { status: subRes.status }
      )
    }

    const subData = await subRes.json()

    // 2. 查询使用量（最近100天）
    const now = new Date()
    const startDate = new Date(now.getTime() - 100 * 24 * 3600 * 1000)
    const fmt = (d) => d.toISOString().split('T')[0]

    const usageRes = await fetch(
      `${url}/dashboard/billing/usage?start_date=${fmt(startDate)}&end_date=${fmt(now)}`,
      { headers: { 'Authorization': `Bearer ${apiKey}` } }
    )

    let usageData = { total_usage: 0 }
    if (usageRes.ok) {
      usageData = await usageRes.json()
    }

    // 计算额度
    const hardLimit = subData.hard_limit_usd || 0
    const isUnlimited = hardLimit >= 100000000
    const totalUsed = (usageData.total_usage || 0) / 100 // 美分转美元
    const remaining = isUnlimited ? Infinity : Math.max(0, hardLimit - totalUsed)

    // 有效期
    const accessUntil = subData.access_until
      ? new Date(subData.access_until * 1000).toLocaleString('zh-CN')
      : '未知'

    return NextResponse.json({
      total: isUnlimited ? '无限' : `$${hardLimit.toFixed(2)}`,
      totalRaw: hardLimit,
      used: `$${totalUsed.toFixed(2)}`,
      usedRaw: totalUsed,
      remaining: isUnlimited ? '无限' : `$${remaining.toFixed(2)}`,
      remainingRaw: remaining,
      isUnlimited,
      accessUntil,
      usagePercent: isUnlimited ? 0 : Math.min(100, (totalUsed / hardLimit) * 100),
    })
  } catch (error) {
    return NextResponse.json(
      { error: `请求失败: ${error.message}` },
      { status: 500 }
    )
  }
}
