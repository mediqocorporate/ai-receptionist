import { demoQuestions } from '../data/demo-questions.js'
import { matchDemoQuestion } from '../lib/question-matcher.js'

export const assistantService = {
  async ask(question, context = {}) {
    await delay(context.fast ? 0 : 280)
    if (String(question).includes('[simulate-error]')) throw new Error('Simulated assistant failure')
    return { answer: matchDemoQuestion(question, demoQuestions), question }
  },
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
