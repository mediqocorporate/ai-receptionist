import { demoQuestions } from '../data/demo-questions.js'
export const knowledgeService = {
  async getSources(answerId) {
    return demoQuestions.find((item) => item.id === answerId)?.sources || []
  },
}
