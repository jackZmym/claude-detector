/**
 * 检测测试套件 - 公共工具函数
 */

/**
 * 计算文本中匹配的特征数量
 * @param {string} text
 * @param {Array<RegExp | string>} patterns
 * @returns {number}
 */
export function countMatches(text, patterns) {
  return patterns.filter(p => {
    if (p instanceof RegExp) return p.test(text)
    return text.toLowerCase().includes(p.toLowerCase())
  }).length
}
