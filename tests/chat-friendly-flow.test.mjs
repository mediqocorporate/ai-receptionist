import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8')
const chat = fs.readFileSync(new URL('../src/components/chat.js', import.meta.url), 'utf8')
const styles = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')

test('pending chat turn clearly shows a ChatGPT-style thinking state', () => {
  assert.match(chat, /data-chat-pending/)
  assert.match(chat, /MediQo is thinking/)
  assert.match(chat, /Preparing practical guidance/)
  assert.match(styles, /\.thinking-status/)
})

test('new questions and completed answers request smart conversation scrolling', () => {
  assert.match(chat, /data-chat-latest/)
  assert.match(app, /scrollConversationIntoView/)
  assert.match(app, /scrollIntoView/)
  assert.match(app, /mode === 'pending'/)
})

test('new assistant answers use a subtle progressive reveal treatment', () => {
  assert.match(chat, /answer-reveal/)
  assert.match(styles, /\.answer-reveal/)
  assert.match(styles, /@keyframes answerReveal/)
})
