export function answerToPlainText(answer = {}) {
  const lines = [answer.intro]
  for (const section of answer.sections || []) {
    if (section.title) lines.push(section.title)
    if (section.body) lines.push(section.body)
    for (const item of section.items || []) lines.push(`- ${item}`)
  }
  return lines.filter(Boolean).join('\n\n')
}

export async function processAsk({ question, conversationId = null, actor = null, anonymousTokenHash = null }, deps) {
  const cleanQuestion = String(question || '').trim()
  if (!cleanQuestion) return { statusCode: 400, body: { code: 'question_required', message: 'Question is required.' } }
  if (cleanQuestion.length > 500) return { statusCode: 400, body: { code: 'question_too_long', message: 'Keep questions to 500 characters or fewer.' } }

  let reservation = null
  if (!actor) {
    reservation = await deps.reserveAnonymous(anonymousTokenHash)
    if (!reservation?.allowed) {
      return { statusCode: 403, body: { code: 'signup_required', message: 'Create a free account to keep asking questions.', remainingFreeAnswers: 0 } }
    }
  }

  try {
    const generated = await deps.generateAnswer({
      question: cleanQuestion,
      safetyIdentifier: actor?.safetyIdentifier || anonymousTokenHash || undefined,
    })

    const persisted = await deps.persistAnswer({
      conversationId,
      userId: actor?.userId || null,
      practiceId: actor?.practiceId || null,
      anonymousSessionId: reservation?.sessionId || null,
      question: cleanQuestion,
      answerText: answerToPlainText(generated.answer),
      answerJson: generated.answer,
      model: generated.model,
      responseId: generated.responseId,
    })

    let remainingFreeAnswers = null
    if (reservation) {
      const completed = await deps.completeAnonymous(reservation.sessionId)
      remainingFreeAnswers = completed.remaining
    }

    return {
      statusCode: 200,
      body: {
        answer: generated.answer,
        conversationId: persisted.conversationId,
        questionLogId: persisted.questionLogId,
        remainingFreeAnswers,
      },
    }
  } catch (error) {
    if (reservation?.sessionId) {
      try { await deps.releaseAnonymous(reservation.sessionId) } catch {}
    }
    throw error
  }
}
