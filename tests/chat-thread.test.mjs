import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8')
const chat = fs.readFileSync(new URL('../src/components/chat.js', import.meta.url), 'utf8')

test('conversation UI keeps prior Q&A turns instead of replacing the current chat', () => {
  assert.match(app, /conversationTurns/)
  assert.match(app, /conversationTurns\.push/)
  assert.match(chat, /renderConversationView/)
  assert.match(chat, /safeTurns\.map/)
})

test('conversation view has a Back action that starts a fresh Ask home conversation', () => {
  assert.match(chat, /data-action="back-to-ask-home"/)
  assert.match(app, /back-to-ask-home/)
  assert.match(app, /conversationId\s*=\s*null/)
  assert.match(app, /conversationTurns\s*=\s*\[\]/)
})
