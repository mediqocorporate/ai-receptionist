import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

export const REQUIRED_SHEETS = [
  'README',
  'Requirements',
  'Questions',
  'Answer Options',
  'Branching Logic',
  'Evidence Criteria',
  'Sources',
]

const ALLOWED_CLASSIFICATIONS = new Set(['MANDATORY', 'ASPIRATIONAL', 'UNVERIFIED'])

function decodeXml(value = '') {
  return String(value)
    .replace(/&#(x?[0-9a-f]+);/gi, (_, code) => String.fromCodePoint(code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : parseInt(code, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function xmlAttributes(raw = '') {
  const attrs = {}
  for (const match of raw.matchAll(/([\w:.-]+)="([^"]*)"/g)) attrs[match[1]] = decodeXml(match[2])
  return attrs
}

function findEocd(buffer) {
  const min = Math.max(0, buffer.length - 0xffff - 22)
  for (let offset = buffer.length - 22; offset >= min; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset
  }
  throw new Error('Invalid XLSX/ZIP file: end-of-central-directory record not found.')
}

function unzipEntries(buffer) {
  const eocd = findEocd(buffer)
  const entryCount = buffer.readUInt16LE(eocd + 10)
  let offset = buffer.readUInt32LE(eocd + 16)
  const entries = new Map()

  for (let i = 0; i < entryCount; i += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Invalid XLSX/ZIP central directory.')
    const method = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const fileNameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const localOffset = buffer.readUInt32LE(offset + 42)
    const fileName = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString('utf8')

    if (!fileName.endsWith('/')) {
      if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`Invalid local ZIP header for ${fileName}.`)
      const localNameLength = buffer.readUInt16LE(localOffset + 26)
      const localExtraLength = buffer.readUInt16LE(localOffset + 28)
      const dataStart = localOffset + 30 + localNameLength + localExtraLength
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize)
      let content
      if (method === 0) content = Buffer.from(compressed)
      else if (method === 8) content = zlib.inflateRawSync(compressed)
      else throw new Error(`Unsupported ZIP compression method ${method} for ${fileName}.`)
      entries.set(fileName, content)
    }

    offset += 46 + fileNameLength + extraLength + commentLength
  }
  return entries
}

function requiredEntry(entries, name) {
  const value = entries.get(name)
  if (!value) throw new Error(`XLSX entry missing: ${name}`)
  return value.toString('utf8')
}

function parseSharedStrings(entries) {
  const buffer = entries.get('xl/sharedStrings.xml')
  if (!buffer) return []
  const xml = buffer.toString('utf8')
  return [...xml.matchAll(/<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g)].map((match) => {
    const text = [...match[1].matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)].map((part) => decodeXml(part[1])).join('')
    return text
  })
}

function columnIndex(cellRef = '') {
  const letters = String(cellRef).match(/^[A-Z]+/i)?.[0]?.toUpperCase() || 'A'
  let index = 0
  for (const ch of letters) index = index * 26 + (ch.charCodeAt(0) - 64)
  return index - 1
}

function parseCellValue(attrs, inner, sharedStrings) {
  if (attrs.t === 'inlineStr') {
    return [...inner.matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)].map((m) => decodeXml(m[1])).join('')
  }
  const raw = inner.match(/<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/)?.[1]
  if (raw === undefined) return null
  const decoded = decodeXml(raw)
  if (attrs.t === 's') return sharedStrings[Number(decoded)] ?? ''
  if (attrs.t === 'str' || attrs.t === 'e') return decoded
  if (attrs.t === 'b') return decoded === '1'
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(decoded)) return Number(decoded)
  return decoded
}

function parseWorksheet(xml, sharedStrings) {
  const rows = []
  for (const rowMatch of xml.matchAll(/<(?:\w+:)?row\b[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/g)) {
    const row = []
    for (const cellMatch of rowMatch[1].matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
      const attrs = xmlAttributes(cellMatch[1])
      row[columnIndex(attrs.r)] = parseCellValue(attrs, cellMatch[2] || '', sharedStrings)
    }
    while (row.length && row[row.length - 1] == null) row.pop()
    rows.push(row)
  }
  return rows
}

export function readXlsxWorkbook(filePath) {
  const entries = unzipEntries(fs.readFileSync(filePath))
  const workbookXml = requiredEntry(entries, 'xl/workbook.xml')
  const relsXml = requiredEntry(entries, 'xl/_rels/workbook.xml.rels')
  const sharedStrings = parseSharedStrings(entries)
  const relationships = new Map()

  for (const match of relsXml.matchAll(/<Relationship\b([^>]*)\/?\s*>/g)) {
    const attrs = xmlAttributes(match[1])
    if (attrs.Id && attrs.Target) relationships.set(attrs.Id, attrs.Target)
  }

  const sheets = new Map()
  for (const match of workbookXml.matchAll(/<(?:\w+:)?sheet\b([^>]*)\/?\s*>/g)) {
    const attrs = xmlAttributes(match[1])
    const target = relationships.get(attrs['r:id'])
    if (!attrs.name || !target) continue
    const normalized = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`
    sheets.set(attrs.name, parseWorksheet(requiredEntry(entries, normalized), sharedStrings))
  }
  return sheets
}

function rowsToObjects(rows, sheetName) {
  if (!rows?.length) throw new Error(`Required sheet ${sheetName} is empty.`)
  const headers = rows[0].map((value) => String(value ?? '').trim())
  return rows.slice(1)
    .filter((row) => row.some((value) => value !== null && value !== undefined && value !== ''))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? null])))
}

function pipeList(value) {
  if (value === null || value === undefined || value === '') return []
  return String(value).split('|').map((part) => part.trim()).filter(Boolean)
}

function semicolonList(value) {
  if (value === null || value === undefined || value === '') return []
  return String(value).split(';').map((part) => part.trim()).filter(Boolean)
}

function mapClassification(value) {
  const text = String(value || '')
  if (/^Mandatory\b/i.test(text)) return 'MANDATORY'
  if (/^Aspirational\b/i.test(text)) return 'ASPIRATIONAL'
  if (/^VALIDATE\b/i.test(text)) return 'UNVERIFIED'
  throw new Error(`Unsupported classification: ${text || '(blank)'}`)
}

function mapValidationStatus(value) {
  const text = String(value || '')
  if (/\bHOLD\b/i.test(text)) return 'HOLD'
  if (text) return 'VALIDATION_REQUIRED'
  return 'VALIDATION_REQUIRED'
}

function readReadme(rows) {
  const values = {}
  for (const row of rows || []) {
    const key = String(row[0] ?? '').trim()
    if (!key) continue
    values[key] = row[1] ?? null
  }
  return values
}

export function validateAccreditationDataset(dataset) {
  const requirementIds = new Set()
  for (const requirement of dataset.requirements || []) {
    if (!requirement?.id) throw new Error('Requirement id is required.')
    if (requirementIds.has(requirement.id)) throw new Error(`Duplicate requirement id: ${requirement.id}`)
    if (!ALLOWED_CLASSIFICATIONS.has(requirement.classification)) throw new Error(`Unsupported classification: ${requirement.classification}`)
    requirementIds.add(requirement.id)
  }

  const questionIds = new Set()
  for (const question of dataset.questions || []) {
    if (!question?.id) throw new Error('Question id is required.')
    if (questionIds.has(question.id)) throw new Error(`Duplicate question id: ${question.id}`)
    if (!requirementIds.has(question.requirementId)) throw new Error(`Question ${question.id} references unknown requirement ${question.requirementId}.`)
    questionIds.add(question.id)
  }

  for (const option of dataset.answerOptions || []) {
    if (!questionIds.has(option.questionId)) throw new Error(`Answer option references unknown question ${option.questionId}.`)
  }
  for (const rule of dataset.branchingRules || []) {
    if (!questionIds.has(rule.questionId)) throw new Error(`Branching rule references unknown question ${rule.questionId}.`)
    if (!requirementIds.has(rule.requirementId)) throw new Error(`Branching rule references unknown requirement ${rule.requirementId}.`)
  }
  for (const evidence of dataset.evidenceCriteria || []) {
    if (!requirementIds.has(evidence.requirementId)) throw new Error(`Evidence criterion references unknown requirement ${evidence.requirementId}.`)
  }
  return dataset
}

export async function importAccreditationWorkbook(filePath) {
  const workbook = readXlsxWorkbook(filePath)
  const missingSheets = REQUIRED_SHEETS.filter((sheet) => !workbook.has(sheet))
  if (missingSheets.length) throw new Error(`Workbook missing required sheets: ${missingSheets.join(', ')}`)

  const readme = readReadme(workbook.get('README'))
  const requirementRows = rowsToObjects(workbook.get('Requirements'), 'Requirements')
  const questionRows = rowsToObjects(workbook.get('Questions'), 'Questions')
  const optionRows = rowsToObjects(workbook.get('Answer Options'), 'Answer Options')
  const branchingRows = rowsToObjects(workbook.get('Branching Logic'), 'Branching Logic')
  const evidenceRows = rowsToObjects(workbook.get('Evidence Criteria'), 'Evidence Criteria')
  const sourceRows = rowsToObjects(workbook.get('Sources'), 'Sources')

  const requirements = requirementRows.map((row) => {
    const contentValidationStatus = mapValidationStatus(row.content_validation_status)
    return {
      id: String(row.requirement_id || '').trim(),
      standardVersion: String(row.standard_version || '').trim(),
      indicator: String(row.indicator || '').trim(),
      criterion: String(row.criterion || '').trim(),
      criterionDescription: String(row.criterion_description || '').trim(),
      classification: mapClassification(row.mandatory_or_aspirational),
      classificationSource: String(row.mandatory_or_aspirational || '').trim(),
      plainEnglishRequirement: String(row.plain_english_requirement || '').trim(),
      applicability: String(row.applicability || '').trim(),
      primaryReadinessQuestion: String(row.primary_readiness_question || '').trim(),
      answerOptions: pipeList(row.answer_options),
      followUpQuestions: pipeList(row.follow_up_questions),
      possibleEvidence: pipeList(row.possible_evidence),
      assessmentBasis: String(row.assessment_basis || '').trim(),
      rules: {
        appearsReady: String(row.appears_ready_rule || '').trim(),
        needsAttention: String(row.needs_attention_rule || '').trim(),
        confirmedGap: String(row.confirmed_gap_rule || '').trim(),
        notChecked: String(row.not_checked_rule || '').trim(),
      },
      quickCheckPriority: String(row.quick_check_priority || '').trim(),
      criticalSafetyArea: String(row.critical_safety_area || '').trim().toLowerCase() === 'yes',
      nationalNotMetCount: row.national_not_met_count === null ? null : Number(row.national_not_met_count),
      nationalNotMetRank: row.national_not_met_rank === null ? null : Number(row.national_not_met_rank),
      contentValidationStatus,
      contentValidationSource: String(row.content_validation_status || '').trim(),
      active: contentValidationStatus !== 'HOLD',
      sources: {
        racgp: String(row.RACGP_source || '').trim(),
        commission: String(row.Commission_source || '').trim(),
      },
    }
  })

  const questions = questionRows.map((row) => ({
    id: String(row.question_id || '').trim(),
    requirementId: String(row.requirement_id || '').trim(),
    purpose: String(row.question_purpose || '').trim(),
    wording: String(row.primary_wording || '').trim(),
    answerOptions: pipeList(row.answer_options),
    showRule: String(row.show_rule || '').trim(),
    contextualisationRule: String(row.contextualisation_rule || '').trim(),
    followUpQuestions: pipeList(row.follow_up_questions),
    evidencePrompt: String(row.evidence_prompt || '').trim(),
    clarificationTemplate: String(row.clarification_template || '').trim(),
    whyWeAsk: String(row.why_we_ask || '').trim(),
    askedBecause: String(row.asked_because || '').trim(),
    quickCheckPriority: String(row.quick_check_priority || '').trim(),
    validationStatus: mapValidationStatus(row.status),
    validationSource: String(row.status || '').trim(),
  }))

  const answerOptions = optionRows.map((row) => ({
    questionId: String(row.question_id || '').trim(),
    order: Number(row.option_order),
    label: String(row.option_label || '').trim(),
    type: String(row.option_type || '').trim(),
    defaultBranchBehaviour: String(row.default_branch_behaviour || '').trim(),
  }))

  const branchingRules = branchingRows.map((row) => ({
    questionId: String(row.question_id || '').trim(),
    order: Number(row.branch_order),
    trigger: String(row.trigger || '').trim(),
    followUpWording: String(row.follow_up_wording || '').trim(),
    suppressionRule: String(row.suppression_rule || '').trim(),
    requirementId: String(row.requirement_id || '').trim(),
  }))

  const evidenceCriteria = evidenceRows.map((row) => ({
    requirementId: String(row.requirement_id || '').trim(),
    evidenceType: String(row.evidence_type || '').trim(),
    role: String(row.role || '').trim(),
    evidenceRule: String(row.evidence_rule || '').trim(),
    assessmentDimensions: semicolonList(row.assessment_dimensions),
  }))

  const sources = sourceRows.map((row) => ({
    id: String(row.source_id || '').trim(),
    publisher: String(row.publisher || '').trim(),
    title: String(row.title || '').trim(),
    currentUse: String(row.current_use || '').trim(),
    url: String(row.url || '').trim(),
    usedFor: String(row.used_for || '').trim(),
    verification: String(row.verification || '').trim(),
  }))

  const dataset = {
    meta: {
      title: String(readme['MediQo Accreditation Assistant – MVP Readiness Question Dataset'] || 'MediQo Accreditation Assistant – MVP Readiness Question Dataset'),
      version: String(readme.Version || ''),
      requiredSheets: REQUIRED_SHEETS,
      generatedFrom: path.basename(filePath),
      questionEngineRule: String(readme['Question-engine rule'] || ''),
      criticalDeveloperRule: String(readme['Critical developer rule'] || ''),
      validationStatus: String(readme['Validation status'] || ''),
    },
    requirements,
    questions,
    answerOptions,
    branchingRules,
    evidenceCriteria,
    sources,
  }

  validateAccreditationDataset(dataset)
  return dataset
}

function summary(dataset) {
  const count = (key, value) => dataset.requirements.filter((item) => item[key] === value).length
  return [
    `requirements=${dataset.requirements.length}`,
    `mandatory=${count('classification', 'MANDATORY')}`,
    `aspirational=${count('classification', 'ASPIRATIONAL')}`,
    `unverified=${count('classification', 'UNVERIFIED')}`,
    `p1=${count('quickCheckPriority', 'P1')}`,
    `p2=${count('quickCheckPriority', 'P2')}`,
    `p3=${count('quickCheckPriority', 'P3')}`,
    `criticalSafety=${dataset.requirements.filter((item) => item.criticalSafetyArea).length}`,
    `hold=${dataset.requirements.filter((item) => !item.active).length}`,
  ].join(' ')
}

async function main() {
  const [, , inputPath, outputPath] = process.argv
  if (!inputPath || !outputPath) throw new Error('Usage: node scripts/import-accreditation-dataset.mjs <input.xlsx> <output.json>')
  const dataset = await importAccreditationWorkbook(path.resolve(inputPath))
  const resolvedOutput = path.resolve(outputPath)
  fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true })
  fs.writeFileSync(resolvedOutput, `${JSON.stringify(dataset, null, 2)}\n`)
  console.log(summary(dataset))
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main().catch((error) => { console.error(error.message); process.exitCode = 1 })