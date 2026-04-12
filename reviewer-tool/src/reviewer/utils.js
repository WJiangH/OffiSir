import {
  DOC_TYPE_LABELS,
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  STRICT_BANNED_WORDS,
  STRICT_TURN_COUNT,
  TURN_BUILD_ORDER,
} from './constants'

const HEAVY_TURN_GROUP = [0, 4, 8, 12, 16, 2, 6, 10, 14, 18]
const LIGHT_TURN_GROUP = [1, 5, 9, 13, 17, 3, 7, 11, 15, 19]
const TURN_EXTRA_SCHEDULE = [
  ...HEAVY_TURN_GROUP,
  ...HEAVY_TURN_GROUP,
  ...LIGHT_TURN_GROUP,
  ...HEAVY_TURN_GROUP,
  ...LIGHT_TURN_GROUP,
  ...LIGHT_TURN_GROUP,
]

export function makeInstanceId() {
  return `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function makeCustomPromptId() {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function normalizePromptText(text = '') {
  return text
    .replace(/\s+/g, ' ')
    .replace(/;/g, ',')
    .replace(/[.!?]+$/g, '')
    .trim()
}

export function stripVarBraces(text = '') {
  return text.replace(/\{([^}]+)\}/g, '$1')
}

export function priorityIndex(priority) {
  const index = PRIORITY_ORDER.indexOf(priority)
  return index === -1 ? PRIORITY_ORDER.length : index
}

function resolveBuildStage(item) {
  const stageIndex = TURN_BUILD_ORDER.findIndex((stage) => stage.match(item))
  if (stageIndex !== -1) return stageIndex

  const byPriority = priorityIndex(item.priority)
  return TURN_BUILD_ORDER.length + byPriority
}

export function sortItems(items, sortKey = 'priority') {
  const nextItems = [...items]

  if (sortKey === 'priority') {
    return nextItems.sort((a, b) => {
      const priorityDelta = priorityIndex(a.priority) - priorityIndex(b.priority)
      if (priorityDelta !== 0) return priorityDelta
      const categoryDelta = String(a.category).localeCompare(String(b.category))
      if (categoryDelta !== 0) return categoryDelta
      return normalizePromptText(a.prompt_text || a.promptText).localeCompare(normalizePromptText(b.prompt_text || b.promptText))
    })
  }

  if (sortKey === 'category') {
    return nextItems.sort((a, b) => {
      const categoryDelta = String(a.category).localeCompare(String(b.category))
      if (categoryDelta !== 0) return categoryDelta
      return normalizePromptText(a.prompt_text || a.promptText).localeCompare(normalizePromptText(b.prompt_text || b.promptText))
    })
  }

  if (sortKey === 'doc_type') {
    return nextItems.sort((a, b) => {
      const docTypeDelta = String(a.doc_type || a.docType).localeCompare(String(b.doc_type || b.docType))
      if (docTypeDelta !== 0) return docTypeDelta
      return normalizePromptText(a.prompt_text || a.promptText).localeCompare(normalizePromptText(b.prompt_text || b.promptText))
    })
  }

  return nextItems.sort((a, b) => normalizePromptText(a.prompt_text || a.promptText).localeCompare(normalizePromptText(b.prompt_text || b.promptText)))
}

export function sortForTurnBuild(items) {
  return [...items].sort((a, b) => {
    const stageDelta = resolveBuildStage(a) - resolveBuildStage(b)
    if (stageDelta !== 0) return stageDelta

    const priorityDelta = priorityIndex(a.priority) - priorityIndex(b.priority)
    if (priorityDelta !== 0) return priorityDelta

    const categoryDelta = String(a.category).localeCompare(String(b.category))
    if (categoryDelta !== 0) return categoryDelta

    const subcategoryDelta = String(a.subcategory).localeCompare(String(b.subcategory))
    if (subcategoryDelta !== 0) return subcategoryDelta

    return normalizePromptText(a.promptText || a.prompt_text).localeCompare(normalizePromptText(b.promptText || b.prompt_text))
  })
}

export function promptMatchesDocType(promptDocType, filterDocType) {
  if (filterDocType === 'all') return true
  if (filterDocType === 'both') return promptDocType === 'both'
  if (filterDocType === 'docx') return promptDocType === 'docx' || promptDocType === 'both'
  if (filterDocType === 'pdf') return promptDocType === 'pdf' || promptDocType === 'both'
  return true
}

export function createSelectedPrompt(prompt) {
  return {
    instanceId: makeInstanceId(),
    sourceId: prompt.id || null,
    promptText: normalizePromptText(prompt.prompt_text || prompt.promptText || ''),
    category: prompt.category || 'manual',
    subcategory: prompt.subcategory || 'manual',
    priority: prompt.priority || 'polish',
    docType: prompt.doc_type || prompt.docType || 'both',
    tags: prompt.tags || [],
    favorite: Boolean(prompt.favorite),
    custom: Boolean(prompt.custom),
  }
}

export function buildTwentyTurnCounts(totalItems, turnCount = STRICT_TURN_COUNT, minPerTurn = 3, maxPerTurn = 6) {
  const maxCap = Math.min(Math.max(maxPerTurn, 1), 7)
  const minFloor = Math.min(Math.max(minPerTurn, 1), maxCap)
  if (totalItems < 1 || totalItems > turnCount * maxCap) return null

  // Fallback for very small totals: one turn with everything
  if (totalItems < minFloor) {
    const counts = Array(turnCount).fill(0)
    counts[0] = totalItems
    return counts
  }

  // Determine how many turns we actually fill.
  // Pick the largest number of turns we can fill while every filled turn has at least min.
  // filledTurns must satisfy: filledTurns * min <= totalItems <= filledTurns * max
  const minTurnsForCapacity = Math.ceil(totalItems / maxCap)  // minimum turns to fit everything
  const maxTurnsAtMin = Math.floor(totalItems / minFloor)     // max turns we can use without going below min
  const filledTurns = Math.min(turnCount, Math.max(minTurnsForCapacity, 1), maxTurnsAtMin)

  // Each filled turn starts at min
  const counts = Array(turnCount).fill(0)
  for (let i = 0; i < filledTurns; i++) counts[i] = minFloor
  let extras = totalItems - filledTurns * minFloor

  // Distribute extras across filled turns, capping at max
  const heavy = []
  const light = []
  for (let i = 0; i < filledTurns; i++) {
    if (i % 2 === 0) heavy.push(i)
    else light.push(i)
  }
  const schedule = [...heavy, ...heavy, ...light, ...heavy, ...light, ...light]

  let scheduleIdx = 0
  while (extras > 0 && schedule.length > 0) {
    const turnIndex = schedule[scheduleIdx % schedule.length]
    if (counts[turnIndex] < maxCap) {
      counts[turnIndex] += 1
      extras -= 1
    }
    scheduleIdx += 1
    if (scheduleIdx > schedule.length * maxCap) break
  }

  return counts
}

export function buildTwentyTurnQueue(items, turnCount = STRICT_TURN_COUNT, minPerTurn = 3, maxPerTurn = 6) {
  const counts = buildTwentyTurnCounts(items.length, turnCount, minPerTurn, maxPerTurn)
  if (!counts) return null

  const turns = []
  let itemIndex = 0

  counts.forEach((count, turnIndex) => {
    const turnItems = items.slice(itemIndex, itemIndex + count)
    itemIndex += count

    turns.push({
      turn: turnIndex + 1,
      items: turnItems,
      text: turnItems.map((item) => stripVarBraces(normalizePromptText(item.promptText || item.prompt_text))).join('; '),
    })
  })

  return turns
}

export function lintPromptText(text) {
  const warnings = []
  const normalized = String(text || '').trim()
  const normalizedLower = normalized.toLowerCase()
  const isReplacementPrompt = /^replace\s+\S+/i.test(normalized)

  if (!normalized) warnings.push('Prompt is empty')
  if (/[.!?]\s*$/.test(normalized)) warnings.push('Drop end punctuation')
  if (normalized.includes(';')) warnings.push('Use one fix per item and keep semicolons for turn separators')
  if (/#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})\b/i.test(normalized)) warnings.push('Use plain color names instead of hex codes')
  if (/\b(verify|check|confirm)\b/i.test(normalized)) warnings.push('Use a direct change request instead of a verification verb')
  if (/\b(because|since)\b/i.test(normalized) || /\bit currently\b/i.test(normalized)) warnings.push('Cut the explanation and keep only the change')
  if (normalized.length > 140) warnings.push('Tighten the item so it stays short and local')

  STRICT_BANNED_WORDS.forEach((word) => {
    if (isReplacementPrompt && normalizedLower.includes(`replace ${word} with`)) return
    if (new RegExp(`\\b${word}\\b`, 'i').test(normalized)) warnings.push(`Replace "${word}" with plain wording`)
  })

  return warnings
}

export function validateQueue(selectedItems, turns, strictMode, turnCount = STRICT_TURN_COUNT, maxPerTurn = 6) {
  const errors = []
  const warnings = []

  if (selectedItems.length > turnCount * maxPerTurn) {
    errors.push(`Trim the selection to ${turnCount * maxPerTurn} prompts or fewer before building turns`)
  }

  selectedItems.forEach((item, index) => {
    const promptWarnings = lintPromptText(item.promptText)
    if (promptWarnings.length > 0) warnings.push(`Item ${index + 1}: ${promptWarnings[0]}`)
  })

  if (selectedItems.length > 0 && turns.length === 0) {
    warnings.push('Build 20 turns to generate the export queue')
  }

  if (!strictMode) return { errors, warnings }

  if (turns.length > 0 && turns.length !== STRICT_TURN_COUNT) {
    errors.push(`Strict mode needs exactly ${STRICT_TURN_COUNT} turns before export`)
  }

  const emptyTurns = turns.filter((turn) => turn.items.length === 0).length
  if (turns.length === STRICT_TURN_COUNT && selectedItems.length >= STRICT_TURN_COUNT && emptyTurns > 0) {
    errors.push('Filled queues cannot include empty turns once you have 20 or more prompts')
  }

  turns.forEach((turn, index) => {
    if (turn.items.length > maxPerTurn) {
      errors.push(`Turn ${index + 1} has more than ${maxPerTurn} items`)
    }

    if (selectedItems.length < STRICT_TURN_COUNT) return
    if (turn.items.length < 1) errors.push(`Turn ${index + 1} must have at least 1 item`)
  })

  return { errors, warnings }
}

export function exportQueue(turns, format = 'markdown', startTurn = 2) {
  return turns
    .map((turn, index) => {
      const heading = format === 'markdown' ? `## Turn ${startTurn + index}` : `Turn ${startTurn + index}`
      return `${heading}\n${turn.text}`
    })
    .join('\n\n')
}

export function formatPriority(priority) {
  return PRIORITY_LABELS[priority] || priority
}

export function formatDocType(docType) {
  return DOC_TYPE_LABELS[docType] || docType
}
