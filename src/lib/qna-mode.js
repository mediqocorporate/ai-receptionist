export function shouldUseLocalQuestionGate({ live = false, user = null, canAsk = true } = {}) {
  return !live && !user && !canAsk
}

export function shouldRecordLocalQuestion({ live = false } = {}) {
  return !live
}
