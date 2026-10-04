export function normalizeQuestion(input = '') {
  return String(input)
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .replace(/[-']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function matchDemoQuestion(input, questions) {
  const normalized = normalizeQuestion(input)
  if (!normalized) return null

  let best = null
  let bestScore = 0

  for (const question of questions) {
    for (const prompt of question.prompts || []) {
      const candidate = normalizeQuestion(prompt)
      if (normalized === candidate) return question
      if (normalized.length > 24 && (normalized.includes(candidate) || candidate.includes(normalized))) return question
    }
  }

  for (const question of questions) {
    for (const related of question.relatedQuestions || []) {
      if (normalized === normalizeQuestion(related)) return question
    }
  }

  for (const question of questions) {
    const words = new Set(normalized.split(' ').filter((word) => word.length > 2))
    const keywords = (question.keywords || []).map(normalizeQuestion).flatMap((item) => item.split(' ')).filter(Boolean)
    const hits = keywords.filter((keyword) => words.has(keyword)).length
    const uniqueKeywordCount = new Set(keywords).size || 1
    const score = hits / uniqueKeywordCount + Math.min(hits, 4) * 0.08
    if (score > bestScore) {
      bestScore = score
      best = question
    }
  }

  return bestScore >= 0.28 ? best : null
}
