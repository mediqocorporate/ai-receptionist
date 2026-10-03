import test from 'node:test'
import assert from 'node:assert/strict'
import { createDefaultState, loadPrototypeState, savePrototypeState, resetPrototypeState } from '../src/lib/persistence.js'

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key) => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    dump: () => Object.fromEntries(map),
  }
}

test('default prototype state is anonymous with persistent visitor id', () => {
  const storage = memoryStorage()
  const state = loadPrototypeState(storage, '')
  assert.equal(state.freeQuestionCount, 0)
  assert.equal(state.user, null)
  assert.ok(state.visitorId.startsWith('mq_'))
  savePrototypeState(state, storage)
  const loaded = loadPrototypeState(storage, '')
  assert.equal(loaded.visitorId, state.visitorId)
})

test('question count persists and malformed JSON recovers safely', () => {
  const storage = memoryStorage()
  const state = createDefaultState('mq_test')
  state.freeQuestionCount = 2
  savePrototypeState(state, storage)
  assert.equal(loadPrototypeState(storage, '').freeQuestionCount, 2)
  storage.setItem('mediqo.prototype.state', '{broken')
  assert.equal(loadPrototypeState(storage, '').freeQuestionCount, 0)
})

test('reset removes saved state', () => {
  const storage = memoryStorage()
  savePrototypeState(createDefaultState('mq_reset'), storage)
  resetPrototypeState(storage)
  assert.equal(storage.getItem('mediqo.prototype.state'), null)
})
