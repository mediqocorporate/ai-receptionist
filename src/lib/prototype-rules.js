export function canAskWithoutSignup(state) {
  return Boolean(state?.user) || (Number(state?.freeQuestionCount) || 0) < 2
}

export function recordAnsweredQuestion(state) {
  if (!state.user) state.freeQuestionCount = Math.max(0, Number(state.freeQuestionCount) || 0) + 1
  return state
}

export function unlockWithUser(state, user) {
  state.user = user
  return state
}
