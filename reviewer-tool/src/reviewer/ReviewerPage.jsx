import React, { useEffect, useMemo, useRef, useState } from 'react'
import CategorySidebar from './components/CategorySidebar'
import ContextPanel from './components/ContextPanel'
import LibraryPanel from './components/LibraryPanel'
import ResizeHandle from './components/ResizeHandle'
import SelectedTray from './components/SelectedTray'
import TaskTabBar from './components/TaskTabBar'
import TurnQueuePanel from './components/TurnQueuePanel'
import AdminPanel from '../components/AdminPanel'
import SaveTaskModal from '../components/SaveTaskModal'
import {
  buildTwentyTurnQueue,
  createSelectedPrompt,
  exportQueue,
  hasPromptVariables,
  makeInstanceId,
  normalizePromptText,
  promptMatchesDocType,
  stripVarBraces,
  sortForTurnBuild,
  sortItems,
  validateQueue,
} from './utils'
import { useUser } from '../lib/UserContext'
import {
  addStar,
  deleteTask as deleteTaskRow,
  fetchCustomPrompts,
  fetchRetryCommands,
  fetchStarCounts,
  fetchUserStars,
  fetchUserTasks,
  insertCustomPrompt,
  insertRetryCommand,
  insertTask,
  removeStar,
  updateTask as updateTaskRow,
  updateWorkflowPriority,
} from '../lib/data'
import { PRIORITY_ORDER } from './constants'
import './reviewer.css'

const CATEGORY_FILE = '/reviewer-data/categories.json'
const MANIFEST_FILE = '/reviewer-data/library-manifest.json'

function flattenPromptLibrary(sections) {
  return sections.flatMap((section) => (
    section.groups.flatMap((group) => (
      group.entries.map((entry) => ({
        id: entry.id,
        category: section.category,
        subcategory: group.subcategory,
        prompt_text: entry.prompt_text,
        priority: group.priority,
        doc_type: entry.doc_type || group.doc_type || 'both',
        tags: [...new Set([...(group.tags || []), ...(entry.tags || [])])],
        favorite: Boolean(entry.favorite),
        active: entry.active ?? true,
        custom: Boolean(entry.custom),
      }))
    ))
  ))
}

function buildSearchText(prompt) {
  return [
    prompt.prompt_text,
    prompt.category_label,
    prompt.subcategory_label,
    ...(prompt.tags || []),
  ]
    .join(' ')
    .toLowerCase()
}

function makeGroupedSelections(selectedItems, categories) {
  const knownCategoryIds = new Set(categories.map((category) => category.id))
  const groups = categories
    .map((category) => ({
      id: category.id,
      label: category.label,
      items: selectedItems.filter((item) => item.category === category.id),
    }))
    .filter((group) => group.items.length > 0)

  const uncategorizedItems = selectedItems.filter((item) => !knownCategoryIds.has(item.category))
  if (uncategorizedItems.length > 0) {
    groups.push({
      id: 'manual',
      label: 'Manual / uncategorized',
      items: uncategorizedItems,
    })
  }

  return groups
}

function makeSelectedCategoryCounts(selectedItems) {
  return selectedItems.reduce((accumulator, item) => ({
    ...accumulator,
    [item.category]: (accumulator[item.category] || 0) + 1,
  }), {})
}

function makeLockedItemIdSet(turns, copyPointer) {
  if (copyPointer <= 0 || !turns.length) return new Set()
  return new Set(
    turns
      .slice(0, copyPointer)
      .flatMap((turn) => turn.items.map((item) => item.instanceId))
  )
}

function buildTurnText(items) {
  return items
    .map((item) => stripVarBraces(normalizePromptText(item.promptText || item.prompt_text)))
    .join('; ')
}

function syncUnlockedTurnsWithSelection(turns, copyPointer, nextSelectedItems) {
  if (!turns.length) return turns
  const lockedTurns = copyPointer > 0 ? turns.slice(0, copyPointer) : []
  const nextItemsById = new Map(nextSelectedItems.map((item) => [item.instanceId, item]))
  const pendingTurns = turns.slice(copyPointer).map((turn) => {
    const items = turn.items
      .filter((item) => nextItemsById.has(item.instanceId))
      .map((item) => nextItemsById.get(item.instanceId) || item)
    return {
      ...turn,
      items,
      text: buildTurnText(items),
    }
  })
  return [...lockedTurns, ...pendingTurns]
}

export default function ReviewerPage() {
  const { user, logout } = useUser()
  const [categories, setCategories] = useState([])
  const [basePrompts, setBasePrompts] = useState([])
  const [customPromptsDb, setCustomPromptsDb] = useState([])
  const [stars, setStars] = useState(new Set())
  const [starCounts, setStarCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedSubcategory, setSelectedSubcategory] = useState('all')
  const [docTypeFilter, setDocTypeFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [librarySort, setLibrarySort] = useState('priority')
  const [strictMode, setStrictMode] = useState(true)
  const [startTurn, setStartTurn] = useState(2)
  const [endTurn, setEndTurn] = useState(20)
  const [minPerTurn, setMinPerTurn] = useState(3)
  const [maxPerTurn, setMaxPerTurn] = useState(6)
  const [selectedItems, setSelectedItems] = useState([])
  const [builtTurns, setBuiltTurns] = useState([])
  const [exportFormat, setExportFormat] = useState('markdown')
  const [savedTasks, setSavedTasks] = useState([])
  const [activeTaskId, setActiveTaskId] = useState(null)
  const [copyPointer, setCopyPointer] = useState(0) // index into builtTurns
  const [flashTaskId, setFlashTaskId] = useState(null) // for save animation
  const [flyingPill, setFlyingPill] = useState(null) // { text, fromRect }
  const [hoveredInstanceIds, setHoveredInstanceIds] = useState(new Set())
  const [lockedInstanceIds, setLockedInstanceIds] = useState(new Set())
  const [showAdmin, setShowAdmin] = useState(false)
  const [showSaveTaskModal, setShowSaveTaskModal] = useState(false)
  const [noteBarOpen, setNoteBarOpen] = useState(true)
  const [editingNote, setEditingNote] = useState(false)
  const [editNoteText, setEditNoteText] = useState('')
  const [buildWarning, setBuildWarning] = useState(null) // { indices }
  const [workflowPriority, setWorkflowPriority] = useState(PRIORITY_ORDER)
  const [selectedTrayHeight, setSelectedTrayHeight] = useState(28) // vh units
  const saveButtonRef = useRef(null)
  const newWorkspaceRef = useRef({ selectedItems: [], builtTurns: [], copyPointer: 0 })
  const selectedItemsRef = useRef(selectedItems)
  const builtTurnsRef = useRef(builtTurns)
  const copyPointerRef = useRef(copyPointer)

  const turnCount = Math.max(1, endTurn - startTurn + 1)

  useEffect(() => {
    let ignore = false

    async function loadData() {
      setLoading(true)
      setError(null)

      try {
        const [categoriesResponse, manifestResponse] = await Promise.all(
          [CATEGORY_FILE, MANIFEST_FILE].map((file) => fetch(file).then((response) => {
            if (!response.ok) throw new Error(`Failed to load ${file}`)
            return response.json()
          }))
        )

        const libraryResponses = await Promise.all(
          manifestResponse.map((file) => fetch(file).then((response) => {
            if (!response.ok) throw new Error(`Failed to load ${file}`)
            return response.json()
          }))
        )

        if (ignore) return

        setCategories(categoriesResponse)
        setBasePrompts(flattenPromptLibrary(libraryResponses))
      } catch (loadError) {
        if (!ignore) setError(String(loadError))
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    loadData()

    return () => { ignore = true }
  }, [])

  // Reset all per-user state on login/logout, then load from Supabase
  useEffect(() => {
    selectedItemsRef.current = selectedItems
  }, [selectedItems])

  useEffect(() => {
    builtTurnsRef.current = builtTurns
  }, [builtTurns])

  useEffect(() => {
    copyPointerRef.current = copyPointer
  }, [copyPointer])

  useEffect(() => {
    // Clear workspace + per-user state whenever user changes (including logout)
    setSelectedItems([])
    setBuiltTurns([])
    setCopyPointer(0)
    setSavedTasks([])
    setActiveTaskId(null)
    setStars(new Set())
    setStarCounts({})
    setCustomPromptsDb([])
    setFlyingPill(null)
    setFlashTaskId(null)
    setHoveredInstanceIds(new Set())
    setLockedInstanceIds(new Set())
    // Reset UI knobs so nothing from the previous session persists
    setSearch('')
    setSelectedCategory('all')
    setSelectedSubcategory('all')
    setDocTypeFilter('all')
    setPriorityFilter('all')
    setFavoritesOnly(false)
    setLibrarySort('priority')
    setExportFormat('markdown')
    setStrictMode(true)
    setStartTurn(2)
    setEndTurn(20)
    setMinPerTurn(3)
    setMaxPerTurn(6)
    setSelectedTrayHeight(28)
    // Hydrate workflow priority from the user record (fall back to default).
    if (Array.isArray(user?.workflow_priority) && user.workflow_priority.length) {
      setWorkflowPriority(user.workflow_priority)
    } else {
      setWorkflowPriority(PRIORITY_ORDER)
    }
    newWorkspaceRef.current = { selectedItems: [], builtTurns: [], copyPointer: 0 }

    if (!user) return
    let ignore = false

    // Fire each fetch independently so a single failure doesn't prevent the
    // others from populating state. Previously all four shared one Promise.all
    // try/catch, so any single rejection (e.g., RLS on one table) left
    // customPromptsDb empty even when the custom_prompts fetch itself
    // succeeded.
    const handleError = (label) => (err) => {
      if (ignore) return
      console.error(`[supabase] ${label} failed`, err)
      setError(String(err.message || err))
    }

    fetchCustomPrompts()
      .then((custom) => {
        if (ignore) return
        console.log(`[custom_prompts] merging ${custom.length} rows into library`)
        setCustomPromptsDb(custom)
      })
      .catch(handleError('fetchCustomPrompts'))

    fetchUserStars(user.id)
      .then((userStars) => { if (!ignore) setStars(userStars) })
      .catch(handleError('fetchUserStars'))

    fetchStarCounts()
      .then((counts) => { if (!ignore) setStarCounts(counts) })
      .catch(handleError('fetchStarCounts'))

    fetchUserTasks(user.id)
      .then((tasks) => {
        if (ignore) return
        console.log('[tasks] fetched', tasks)
        setSavedTasks(
          tasks.map((t) => {
            const cfg = t.config || {}
            const baseStart = cfg.startTurn ?? 2
            const stampedTurns = (t.turns || []).map((turn, idx) => (
              turn?.displayNumber === undefined
                ? { ...turn, displayNumber: baseStart + idx }
                : turn
            ))
            return {
              id: t.id,
              name: t.task_name,
              note: t.note || null,
              selectedItems: t.selected_prompts || [],
              builtTurns: stampedTurns,
              copyPointer: t.copy_progress || 0,
              config: t.config || null,
            }
          })
        )
      })
      .catch(handleError('fetchUserTasks'))

    return () => { ignore = true }
  }, [user])

  useEffect(() => {
    if (!categories.length) return
    if (selectedCategory === 'all') return
    if (!categories.some((category) => category.id === selectedCategory)) {
      setSelectedCategory('all')
    }
  }, [categories, selectedCategory])

  useEffect(() => {
    const activeCategory = categories.find((category) => category.id === selectedCategory)
    if (!activeCategory) return

    const subcategoryIds = new Set(activeCategory.subcategories.map((subcategory) => subcategory.id))
    if (selectedSubcategory !== 'all' && !subcategoryIds.has(selectedSubcategory)) {
      setSelectedSubcategory('all')
    }
  }, [categories, selectedCategory, selectedSubcategory])

  // Auto-save active task OR keep new-workspace state in sync
  useEffect(() => {
    if (activeTaskId === null) {
      newWorkspaceRef.current = { selectedItems, builtTurns, copyPointer }
      return
    }
    setSavedTasks((current) =>
      current.map((task) =>
        task.id === activeTaskId
          ? { ...task, selectedItems, builtTurns, copyPointer }
          : task
      )
    )
  }, [selectedItems, builtTurns, copyPointer, activeTaskId])

  const openSaveTaskModal = () => {
    if (!user) return
    setShowSaveTaskModal(true)
  }

  const confirmSaveTask = async ({ name, note }) => {
    if (!user) return
    const taskName = name || `task-${savedTasks.length}`
    const count = selectedItems.length
    const config = { startTurn, endTurn, minPerTurn, maxPerTurn }

    // Launch flying pill animation from the Save button to the tab bar
    if (saveButtonRef.current) {
      const rect = saveButtonRef.current.getBoundingClientRect()
      setFlyingPill({ text: `${taskName} · ${count}`, fromRect: rect })
      setTimeout(() => setFlyingPill(null), 700)
    }

    try {
      const row = await insertTask({
        userId: user.id,
        taskName,
        note,
        selectedPrompts: selectedItems,
        turns: builtTurns,
        copyProgress: copyPointer,
        config,
      })
      const newTask = {
        id: row.id,
        name: row.task_name,
        note: row.note || null,
        selectedItems: row.selected_prompts || [],
        builtTurns: row.turns || [],
        copyPointer: row.copy_progress || 0,
        config: row.config || null,
      }
      setSavedTasks((current) => [...current, newTask])
      setActiveTaskId(null)
      setBuiltTurns([])
      setCopyPointer(0)
      setShowSaveTaskModal(false)
      setTimeout(() => setFlashTaskId(row.id), 600)
      setTimeout(() => setFlashTaskId(null), 1800)
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  const applySelectedItemsChange = (updater, options = {}) => {
    const { clearTurns = false, syncUnlockedTurns = false } = options
    const nextSelectedItems = typeof updater === 'function'
      ? updater(selectedItemsRef.current)
      : updater

    selectedItemsRef.current = nextSelectedItems
    setSelectedItems(nextSelectedItems)

    if (clearTurns) {
      builtTurnsRef.current = []
      copyPointerRef.current = 0
      setBuiltTurns([])
      setCopyPointer(0)
      return
    }

    if (syncUnlockedTurns) {
      const nextBuiltTurns = syncUnlockedTurnsWithSelection(
        builtTurnsRef.current,
        copyPointerRef.current,
        nextSelectedItems
      )
      builtTurnsRef.current = nextBuiltTurns
      setBuiltTurns(nextBuiltTurns)
    }
  }

  const startNewTask = () => {
    setActiveTaskId(null)
    setSelectedItems(newWorkspaceRef.current.selectedItems)
    setBuiltTurns(newWorkspaceRef.current.builtTurns)
    setCopyPointer(newWorkspaceRef.current.copyPointer)
    // Start value always resets to default 2 for a new workspace
    setStartTurn(2)
    setEndTurn(20)
    setMinPerTurn(3)
    setMaxPerTurn(6)
  }

  const switchToTask = (taskId) => {
    // Clicking the active tab unselects it -> restore the new-workspace state
    if (taskId === activeTaskId) {
      startNewTask()
      return
    }
    // Save current new-workspace state before switching into a task (only when coming from +New)
    if (activeTaskId === null) {
      newWorkspaceRef.current = {
        selectedItems: [...selectedItems],
        builtTurns: [...builtTurns],
        copyPointer,
      }
    }
    const task = savedTasks.find((t) => t.id === taskId)
    if (!task) return
    console.log('[tasks] switchToTask', { taskId, task })
    setActiveTaskId(taskId)
    setSelectedItems(task.selectedItems)
    setBuiltTurns(task.builtTurns)
    setCopyPointer(task.copyPointer || 0)
    setNoteBarOpen(true)
    setEditingNote(false)
    // Restore the saved task's config so Start doesn't leak from the previous workspace
    const cfg = task.config || {}
    setStartTurn(cfg.startTurn ?? 2)
    setEndTurn(cfg.endTurn ?? 20)
    setMinPerTurn(cfg.minPerTurn ?? 3)
    setMaxPerTurn(cfg.maxPerTurn ?? 6)
  }

  const deleteTask = async (taskId) => {
    setSavedTasks((current) => current.filter((t) => t.id !== taskId))
    if (activeTaskId === taskId) {
      setActiveTaskId(null)
      setSelectedItems(newWorkspaceRef.current.selectedItems)
      setBuiltTurns(newWorkspaceRef.current.builtTurns)
      setCopyPointer(newWorkspaceRef.current.copyPointer)
      setStartTurn(2)
      setEndTurn(20)
      setMinPerTurn(3)
      setMaxPerTurn(6)
    }
    try {
      if (user) await deleteTaskRow(taskId, user.id)
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  const updateActiveTask = async () => {
    if (activeTaskId === null) return
    setFlashTaskId(activeTaskId)
    setTimeout(() => setFlashTaskId(null), 1200)
    try {
      await updateTaskRow(activeTaskId, user.id, {
        selectedPrompts: selectedItems,
        turns: builtTurns,
        copyProgress: copyPointer,
        config: { startTurn, endTurn, minPerTurn, maxPerTurn },
      })
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  const saveActiveTaskNote = async (newNote) => {
    if (activeTaskId === null || !user) return
    const trimmed = (newNote ?? '').trim()
    const noteValue = trimmed ? trimmed : null
    setSavedTasks((current) => current.map((t) =>
      t.id === activeTaskId ? { ...t, note: noteValue } : t
    ))
    try {
      await updateTaskRow(activeTaskId, user.id, {
        selectedPrompts: selectedItems,
        turns: builtTurns,
        copyProgress: copyPointer,
        config: { startTurn, endTurn, minPerTurn, maxPerTurn },
        note: noteValue,
      })
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  const removeRemainingTurns = () => {
    if (copyPointer === 0 || !builtTurns.length) return
    // Keep the copied turns visible (locked, green) with their existing turn
    // numbers. Drop everything after. Trim selectedItems to only the items in
    // kept turns — but those items remain locked in Selected Prompts.
    const keptTurns = builtTurns.slice(0, copyPointer)
    const keptItemIds = new Set(
      keptTurns.flatMap((turn) => turn.items.map((item) => item.instanceId))
    )
    const keptSelected = selectedItems.filter((item) => keptItemIds.has(item.instanceId))
    const lastKept = keptTurns[keptTurns.length - 1]
    const lastKeptNumber = lastKept?.displayNumber ?? (startTurn + keptTurns.length - 1)
    selectedItemsRef.current = keptSelected
    builtTurnsRef.current = keptTurns
    setSelectedItems(keptSelected)
    setBuiltTurns(keptTurns)
    // Start now points at the next new turn to build.
    setStartTurn(lastKeptNumber + 1)
  }

  // Renumber every non-copied turn so displayNumbers stay contiguous from
  // (last copied turn's displayNumber + 1). Also returns the new startTurn
  // that satisfies the invariant "startTurn == first rebuildable turn's
  // displayNumber" (skipping any contiguous red/needsEdit turns).
  const renumberTurns = (turns, copyPointerValue, fallbackStartTurn) => {
    const lastCopied = turns[copyPointerValue - 1]
    const firstNonCopiedNumber = lastCopied
      ? (lastCopied.displayNumber ?? 1) + 1
      : fallbackStartTurn
    const renumbered = turns.map((t, i) => {
      if (i < copyPointerValue) return t
      return { ...t, displayNumber: firstNonCopiedNumber + (i - copyPointerValue) }
    })
    // Walk past the contiguous red duplicates immediately after the copied
    // prefix to find the first rebuildable slot.
    let frozenEnd = copyPointerValue
    while (frozenEnd < renumbered.length && renumbered[frozenEnd]?.needsEdit) {
      frozenEnd += 1
    }
    const nextStartTurn = frozenEnd === copyPointerValue
      ? firstNonCopiedNumber
      : (renumbered[frozenEnd - 1].displayNumber + 1)
    return { turns: renumbered, startTurn: nextStartTurn }
  }

  const removeTurn = (turnIndex) => {
    const turn = builtTurns[turnIndex]
    if (!turn) return
    // Locked (copied) turns cannot be removed — they are a permanent record.
    if (turnIndex < copyPointer) return
    const removedIds = new Set(turn.items.map((item) => item.instanceId))
    const nextSelectedItems = selectedItemsRef.current.filter((item) => !removedIds.has(item.instanceId))
    const filteredTurns = builtTurnsRef.current.filter((_, i) => i !== turnIndex)
    const { turns: nextBuiltTurns, startTurn: nextStartTurn } = renumberTurns(
      filteredTurns,
      copyPointerRef.current,
      startTurn,
    )
    selectedItemsRef.current = nextSelectedItems
    builtTurnsRef.current = nextBuiltTurns
    setSelectedItems(nextSelectedItems)
    setBuiltTurns(nextBuiltTurns)
    setStartTurn(nextStartTurn)
  }

  const updateTurnText = (turnIndex, newText) => {
    const turn = builtTurns[turnIndex]
    if (!turn) return
    // Split by semicolons, trim, map to items by index
    const chunks = newText.split(';').map((s) => s.trim()).filter(Boolean)
    if (chunks.length === 0) return
    // Update corresponding selectedItems by instanceId
    const updatedItemIds = new Set()
    setSelectedItems((current) =>
      current.map((item) => {
        const idx = turn.items.findIndex((ti) => ti.instanceId === item.instanceId)
        if (idx === -1 || idx >= chunks.length) return item
        updatedItemIds.add(item.instanceId)
        return { ...item, promptText: chunks[idx], edited: true }
      })
    )
    // Update the turn itself (non-destructive: update text and item texts)
    setBuiltTurns((current) =>
      current.map((t, i) => {
        if (i !== turnIndex) return t
        const newItems = t.items.map((item, idx) => (
          idx < chunks.length ? { ...item, promptText: chunks[idx] } : item
        ))
        const nextText = chunks.join('; ')
        // A red (needsEdit) turn becomes normal once its text diverges from
        // the original it was duplicated from.
        const stillNeedsEdit = t.needsEdit && nextText === (t.originalText ?? '')
        return {
          ...t,
          items: newItems,
          text: nextText,
          needsEdit: stillNeedsEdit,
        }
      })
    )
  }

  const duplicateCopiedTurn = (turnIndex) => {
    if (copyPointer === 0) return
    // Spec: only the most recently copied turn (index = copyPointer - 1) exposes
    // the + button. Guard just in case the caller passes something else.
    const sourceIndex = turnIndex ?? (copyPointer - 1)
    const source = builtTurnsRef.current[sourceIndex]
    if (!source) return

    // Fresh instanceIds so the duplicated items don't collide with the locked
    // originals in selectedItems.
    const duplicateItems = source.items.map((item) => ({
      ...item,
      instanceId: makeInstanceId(),
    }))

    const sourceNumber = source.displayNumber ?? (startTurn + sourceIndex)
    const newTurn = {
      turn: (source.turn ?? sourceIndex) + 1,
      items: duplicateItems,
      text: source.text,
      displayNumber: sourceNumber + 1,
      needsEdit: true,
      originalText: source.text,
      sourceDisplayNumber: sourceNumber,
    }

    // Insert the new red turn right after the last copied turn. Then
    // renumber everything non-copied so displayNumbers stay contiguous and
    // startTurn lands just past the red prefix.
    const insertionIndex = copyPointer
    const insertedTurns = [
      ...builtTurnsRef.current.slice(0, insertionIndex),
      newTurn,
      ...builtTurnsRef.current.slice(insertionIndex),
    ]
    const { turns: nextBuiltTurns, startTurn: nextStartTurn } = renumberTurns(
      insertedTurns,
      copyPointer,
      startTurn,
    )

    const nextSelectedItems = [...selectedItemsRef.current, ...duplicateItems]

    builtTurnsRef.current = nextBuiltTurns
    selectedItemsRef.current = nextSelectedItems
    setBuiltTurns(nextBuiltTurns)
    setSelectedItems(nextSelectedItems)
    setStartTurn(nextStartTurn)
  }

  const copyCurrentTurn = async () => {
    if (!builtTurns.length || copyPointer >= builtTurns.length) return
    const turn = builtTurns[copyPointer]
    if (!turn.text) {
      // Skip empty turns
      setCopyPointer((p) => p + 1)
      return
    }
    if (turn.needsEdit) {
      // Red (duplicated-but-not-yet-edited) turns must be edited first
      return
    }
    try {
      await navigator.clipboard.writeText(turn.text)
      // If this turn was a duplicate (and has since been edited to white), log a retry
      if (
        turn.originalText !== undefined
        && user
        && activeTaskId !== null
        && turn.text !== turn.originalText
      ) {
        insertRetryCommand({
          userId: user.id,
          taskId: activeTaskId,
          originalTurn: turn.sourceDisplayNumber ?? null,
          retryTurn: turn.displayNumber ?? null,
          originalPrompt: turn.originalText,
          revisedPrompt: turn.text,
        }).catch((err) => setError(String(err.message || err)))
      }
      setCopyPointer((p) => p + 1)
    } catch {
      // clipboard failed
    }
  }

  const resetCopyProgress = () => {
    setCopyPointer(0)
  }

  const mergedCustomPrompts = useMemo(() => (
    customPromptsDb.map((row) => ({
      id: row.id,
      category: row.category,
      subcategory: row.subcategory,
      prompt_text: row.prompt_text,
      priority: 'polish',
      doc_type: 'both',
      tags: ['custom'],
      favorite: false,
      active: true,
      custom: true,
    }))
  ), [customPromptsDb])

  const prompts = useMemo(() => [...basePrompts, ...mergedCustomPrompts], [basePrompts, mergedCustomPrompts])
  const activeCategory = categories.find((category) => category.id === selectedCategory)
  const categoryLookup = Object.fromEntries(categories.map((category) => [category.id, category]))

  const promptsWithLabels = useMemo(() => (
    prompts.map((prompt) => ({
      ...prompt,
      favorite: stars.has(prompt.id),
      category_label: categoryLookup[prompt.category]?.label || prompt.category,
      subcategory_label: categoryLookup[prompt.category]?.subcategories?.find((subcategory) => subcategory.id === prompt.subcategory)?.label || prompt.subcategory,
    }))
  ), [prompts, stars, categoryLookup])

  const libraryCategoryCounts = {}
  promptsWithLabels.forEach((prompt) => {
    if (!prompt.active) return
    libraryCategoryCounts[prompt.category] = (libraryCategoryCounts[prompt.category] || 0) + 1
  })

  const subcategoryCounts = {}
  promptsWithLabels.forEach((prompt) => {
    if (!prompt.active) return
    subcategoryCounts[prompt.subcategory] = (subcategoryCounts[prompt.subcategory] || 0) + 1
  })

  const selectedCategoryCounts = useMemo(
    () => makeSelectedCategoryCounts(selectedItems),
    [selectedItems]
  )

  const groupedSelections = useMemo(
    () => makeGroupedSelections(selectedItems, categories),
    [selectedItems, categories]
  )

  const searchTerm = search.trim().toLowerCase()
  const filteredPrompts = sortItems(
    promptsWithLabels.filter((prompt) => {
      if (!prompt.active) return false
      // Starred-only mode: ignore category/subcategory filters, show all starred
      if (favoritesOnly) {
        if (!prompt.favorite) return false
      } else if (selectedCategory === 'all') {
        // All mode — no category / subcategory filter.
      } else {
        if (selectedCategory && prompt.category !== selectedCategory) return false
        if (selectedSubcategory !== 'all' && prompt.subcategory !== selectedSubcategory) return false
      }
      if (!promptMatchesDocType(prompt.doc_type, docTypeFilter)) return false
      if (priorityFilter !== 'all' && prompt.priority !== priorityFilter) return false
      if (searchTerm && !buildSearchText(prompt).includes(searchTerm)) return false
      return true
    }),
    librarySort
  )

  const isAllBrowse = selectedCategory === 'all' && !favoritesOnly && !searchTerm
  const displayedPrompts = useMemo(() => {
    if (!isAllBrowse) return filteredPrompts
    const totalStars = Object.values(starCounts).reduce((sum, n) => sum + n, 0)
    if (totalStars > 0) {
      return [...filteredPrompts]
        .sort((a, b) => (starCounts[b.id] || 0) - (starCounts[a.id] || 0))
        .slice(0, 100)
    }
    return filteredPrompts.slice(0, 100)
  }, [isAllBrowse, filteredPrompts, starCounts])

  const queueValidation = validateQueue(selectedItems, builtTurns, strictMode, turnCount, maxPerTurn)
  const exportText = exportQueue(builtTurns, exportFormat, startTurn)

  const addPrompt = (prompt) => {
    applySelectedItemsChange((current) => [...current, createSelectedPrompt(prompt)])
  }

  const removePromptBySourceId = (sourceId) => {
    const lockedItemIds = makeLockedItemIdSet(builtTurnsRef.current, copyPointerRef.current)
    applySelectedItemsChange(
      (current) => current.filter((item) => item.sourceId !== sourceId || lockedItemIds.has(item.instanceId)),
      { syncUnlockedTurns: true }
    )
  }

  const removeItem = (instanceId) => {
    const lockedItemIds = makeLockedItemIdSet(builtTurnsRef.current, copyPointerRef.current)
    if (lockedItemIds.has(instanceId)) return
    applySelectedItemsChange(
      (current) => current.filter((item) => item.instanceId !== instanceId),
      { syncUnlockedTurns: true }
    )
  }

  const selectedSourceIds = useMemo(
    () => new Set(selectedItems.map((item) => item.sourceId).filter(Boolean)),
    [selectedItems]
  )

  const addCustomPrompt = async (subcategoryId, promptText) => {
    if (!user) {
      console.warn('[custom_prompts] addCustomPrompt called with no user — ignoring')
      return
    }
    const normalizedText = normalizePromptText(promptText)
    if (!normalizedText) return
    if (!selectedCategory || selectedCategory === 'all') {
      setError('Pick a specific category before adding a custom prompt.')
      return
    }

    try {
      const row = await insertCustomPrompt({
        userId: user.id,
        category: selectedCategory,
        subcategory: subcategoryId,
        promptText: normalizedText,
      })
      // Row successfully persisted in Supabase — merge into library state
      setCustomPromptsDb((current) => [...current, row])
      const nextPrompt = {
        id: row.id,
        category: row.category,
        subcategory: row.subcategory,
        prompt_text: row.prompt_text,
        priority: 'polish',
        doc_type: 'both',
        tags: ['custom'],
        favorite: false,
        active: true,
        custom: true,
      }
      applySelectedItemsChange((current) => [...current, createSelectedPrompt(nextPrompt)])
    } catch (err) {
      console.error('[custom_prompts] addCustomPrompt failed', err)
      setError(`Couldn't save custom prompt: ${err.message || err}`)
    }
  }

  const toggleFavorite = async (promptId) => {
    if (!user) return
    const isStarred = stars.has(promptId)
    // Optimistic update
    setStars((current) => {
      const next = new Set(current)
      if (isStarred) next.delete(promptId)
      else next.add(promptId)
      return next
    })
    setStarCounts((current) => ({
      ...current,
      [promptId]: Math.max(0, (current[promptId] || 0) + (isStarred ? -1 : 1)),
    }))
    try {
      if (isStarred) await removeStar(user.id, promptId)
      else await addStar(user.id, promptId)
    } catch (err) {
      // Revert on failure
      setStars((current) => {
        const next = new Set(current)
        if (isStarred) next.add(promptId)
        else next.delete(promptId)
        return next
      })
      setStarCounts((current) => ({
        ...current,
        [promptId]: Math.max(0, (current[promptId] || 0) + (isStarred ? 1 : -1)),
      }))
      setError(String(err.message || err))
    }
  }

  const deduplicateSelected = () => {
    const lockedItemIds = makeLockedItemIdSet(builtTurnsRef.current, copyPointerRef.current)
    applySelectedItemsChange((current) => {
      const seen = new Set()
      return current.filter((item) => {
        if (lockedItemIds.has(item.instanceId)) return true
        const normalized = normalizePromptText(item.promptText).toLowerCase()
        if (seen.has(normalized)) return false
        seen.add(normalized)
        return true
      })
    }, { syncUnlockedTurns: true })
  }

  const clearSelected = () => {
    applySelectedItemsChange([], { clearTurns: true })
  }

  const updateItemText = (instanceId, newText) => {
    const lockedItemIds = makeLockedItemIdSet(builtTurnsRef.current, copyPointerRef.current)
    if (lockedItemIds.has(instanceId)) return
    applySelectedItemsChange((current) =>
      current.map((item) =>
        item.instanceId === instanceId ? { ...item, promptText: newText, edited: true } : item
      )
    , { syncUnlockedTurns: true })
  }

  const addSubcategory = (name) => {
    if (!activeCategory) return
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    if (!id) return
    setCategories((current) =>
      current.map((cat) => {
        if (cat.id !== selectedCategory) return cat
        if (cat.subcategories.some((sub) => sub.id === id)) return cat
        return {
          ...cat,
          subcategories: [...cat.subcategories, { id, label: name, description: `Custom subcategory` }],
        }
      })
    )
    setSelectedSubcategory(id)
  }

  const addCategory = (name) => {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    if (!id) return
    setCategories((current) => {
      if (current.some((cat) => cat.id === id)) return current
      return [...current, { id, label: name, priority_group: 'polish', subcategories: [] }]
    })
    setSelectedCategory(id)
    setSelectedSubcategory('all')
  }

  const clearTurns = () => {
    builtTurnsRef.current = []
    copyPointerRef.current = 0
    setBuiltTurns([])
    setCopyPointer(0)
  }

  const performBuildTurns = () => {
    // Extend the locked prefix past copied turns to include any contiguous
    // red (needsEdit) turns — those were manually inserted via Duplicate and
    // must survive rebuilds.
    let frozenEnd = copyPointer
    while (frozenEnd < builtTurns.length && builtTurns[frozenEnd]?.needsEdit) {
      frozenEnd += 1
    }
    const frozenTurns = frozenEnd > 0 ? builtTurns.slice(0, frozenEnd) : []
    const frozenItemIds = new Set(
      frozenTurns.flatMap((turn) => turn.items.map((item) => item.instanceId))
    )
    const pendingItems = selectedItems.filter((item) => !frozenItemIds.has(item.instanceId))

    if (pendingItems.length === 0) {
      builtTurnsRef.current = frozenTurns
      setBuiltTurns(frozenTurns)
      return
    }

    // startTurn is already advanced past the frozen prefix (the duplicate
    // flow and removeRemainingTurns both maintain this invariant).
    const newRange = Math.max(1, endTurn - startTurn + 1)
    if (pendingItems.length > newRange * maxPerTurn) {
      return
    }

    const sortedItems = sortForTurnBuild(pendingItems, workflowPriority)
    const appendedTurns = buildTwentyTurnQueue(
      sortedItems,
      newRange,
      minPerTurn,
      maxPerTurn
    )

    if (!appendedTurns) return

    const stamped = appendedTurns.map((turn, idx) => ({
      ...turn,
      displayNumber: startTurn + idx,
    }))

    const nextBuiltTurns = [...frozenTurns, ...stamped]
    builtTurnsRef.current = nextBuiltTurns
    setBuiltTurns(nextBuiltTurns)
  }

  const reorderPriority = (nextOrder) => {
    setWorkflowPriority(nextOrder)
    if (!user) return
    updateWorkflowPriority(user.id, nextOrder).catch((err) => {
      console.error('[workflow_priority] save failed', err)
      setError(`Couldn't save workflow priority: ${err.message || err}`)
    })
  }

  const resetPriorityToDefault = () => {
    setWorkflowPriority(PRIORITY_ORDER)
    if (!user) return
    updateWorkflowPriority(user.id, null).catch((err) => {
      console.error('[workflow_priority] reset failed', err)
      setError(`Couldn't reset workflow priority: ${err.message || err}`)
    })
  }

  const collectUneditedIndices = () => {
    const out = []
    selectedItems.forEach((item, idx) => {
      if (hasPromptVariables(item.promptText) && item.edited === false) {
        out.push(idx + 1)
      }
    })
    return out
  }

  const buildTurns = () => {
    const uneditedIndices = collectUneditedIndices()
    if (uneditedIndices.length > 0) {
      setBuildWarning({ indices: uneditedIndices })
      return
    }
    performBuildTurns()
  }

  const effectiveHighlight = lockedInstanceIds.size > 0 ? lockedInstanceIds : hoveredInstanceIds

  const lockedItemSet = useMemo(() => {
    return makeLockedItemIdSet(builtTurns, copyPointer)
  }, [builtTurns, copyPointer])

  const clickItem = (instanceId) => {
    setLockedInstanceIds((current) => {
      if (current.size === 1 && current.has(instanceId)) return new Set()
      return new Set([instanceId])
    })
  }

  const clickTurn = (turnIndex) => {
    const turn = builtTurns[turnIndex]
    if (!turn) return
    const ids = turn.items.map((i) => i.instanceId)
    setLockedInstanceIds((current) => {
      if (current.size === ids.length && ids.every((id) => current.has(id))) return new Set()
      return new Set(ids)
    })
  }

  const clearLockedHighlight = () => {
    if (lockedInstanceIds.size > 0) setLockedInstanceIds(new Set())
  }

  const copyExport = async () => {
    if (exportFormat === 'retries') {
      if (!user || activeTaskId === null) {
        setError('Save this workspace as a task before exporting failed fixes.')
        return
      }
      try {
        const rows = await fetchRetryCommands(user.id, activeTaskId)
        const taskName = savedTasks.find((t) => t.id === activeTaskId)?.name || `task-${activeTaskId}`
        const body = [
          `# Failed fixes — ${taskName}`,
          '',
          rows.length === 0 ? '_No failed fixes recorded for this task yet._' : null,
          ...rows.map((r) => [
            `## Turn ${r.retry_turn}${r.original_turn != null ? ` (retry of Turn ${r.original_turn})` : ''}`,
            '',
            '**Original**',
            '',
            r.original_prompt,
            '',
            '**Revised**',
            '',
            r.revised_prompt,
            '',
          ].join('\n')),
        ].filter((line) => line !== null).join('\n')
        const blob = new Blob([body], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${taskName}-failed-fixes.md`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } catch (err) {
        setError(String(err.message || err))
      }
      return
    }
    try {
      await navigator.clipboard.writeText(exportText)
    } catch {
      // clipboard failed
    }
  }

  return (
    <div className="reviewer-page" onClick={clearLockedHighlight}>
      <header className="reviewer-header">
        <h1>OffiSir</h1>
        {user && (
          <span className="reviewer-user-chip">
            {user.name}
            {user.is_admin && (
              <button
                onClick={() => {
                  const pw = window.prompt('Admin password:')
                  if (pw === null) return
                  if (pw === 'JJ') setShowAdmin(true)
                  else window.alert('Incorrect password')
                }}
                type="button"
                title="Open admin panel"
              >
                Admin
              </button>
            )}
            <button onClick={logout} type="button" title="Log out">sign out</button>
          </span>
        )}
      </header>
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
      {showSaveTaskModal && (
        <SaveTaskModal
          defaultName={`task-${savedTasks.length}`}
          onCancel={() => setShowSaveTaskModal(false)}
          onSave={confirmSaveTask}
        />
      )}
      {buildWarning && (
        <div className="save-task-backdrop" onClick={() => setBuildWarning(null)}>
          <div className="save-task-modal" onClick={(e) => e.stopPropagation()}>
            <div className="save-task-header">
              <h3>Unedited variables</h3>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: '#18222f' }}>
              {`Prompts ${buildWarning.indices.map((n) => `#${n}`).join(', ')} still have default variable values. Build anyway?`}
            </p>
            <div className="save-task-actions">
              <button
                className="save-task-cancel"
                onClick={() => setBuildWarning(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="save-task-submit"
                onClick={() => {
                  setBuildWarning(null)
                  performBuildTurns()
                }}
                type="button"
              >
                Build anyway
              </button>
            </div>
          </div>
        </div>
      )}

      <TaskTabBar
        tasks={savedTasks}
        activeTaskId={activeTaskId}
        flashTaskId={flashTaskId}
        onSwitchTask={switchToTask}
        onNewTask={startNewTask}
        onDeleteTask={deleteTask}
      />

      {error && <div className="reviewer-error-banner">{error}</div>}

      {loading ? (
        <div className="reviewer-loading">Loading reviewer library…</div>
      ) : (
        <div className="reviewer-shell">
          <CategorySidebar
            categories={categories}
            counts={selectedCategoryCounts}
            onSelectCategory={setSelectedCategory}
            selectedCategory={selectedCategory}
            totalPromptCount={promptsWithLabels.filter((p) => p.active).length}
            priorityOrder={workflowPriority}
            onReorderPriority={reorderPriority}
            onResetPriority={resetPriorityToDefault}
          />

          <ContextPanel
            category={activeCategory}
            isAllSelected={selectedCategory === 'all'}
            onAddCategory={addCategory}
            onAddSubcategory={addSubcategory}
            onSelectSubcategory={setSelectedSubcategory}
            subcategoryCounts={subcategoryCounts}
            selectedSubcategory={selectedSubcategory}
            totalCount={libraryCategoryCounts[selectedCategory] || 0}
          />

          <LibraryPanel
            activeCategory={activeCategory}
            activeCategoryLabel={activeCategory?.label || 'Prompt library'}
            docTypeFilter={docTypeFilter}
            favoritesOnly={favoritesOnly}
            librarySort={librarySort}
            onAddCustomPrompt={addCustomPrompt}
            onAddPrompt={addPrompt}
            onRemovePromptBySourceId={removePromptBySourceId}
            onDocTypeFilterChange={setDocTypeFilter}
            onFavoritesOnlyChange={setFavoritesOnly}
            onLibrarySortChange={setLibrarySort}
            onPriorityFilterChange={setPriorityFilter}
            onSearchChange={setSearch}
            onToggleFavorite={toggleFavorite}
            priorityFilter={priorityFilter}
            prompts={displayedPrompts}
            search={search}
            selectedSourceIds={selectedSourceIds}
            selectedSubcategory={selectedSubcategory}
            starCounts={starCounts}
            allMode={selectedCategory === 'all' && !favoritesOnly}
            allPromptsForMatching={promptsWithLabels.filter((p) => p.active)}
          />

          <div className="reviewer-right-rail">
            {activeTaskId !== null && (() => {
              // Derive the note text directly from savedTasks on every render.
              // No intermediate state, no useEffect sync — stale state cannot occur.
              const activeTaskNote = savedTasks.find((t) => t.id === activeTaskId)?.note || ''
              const hasNote = !!activeTaskNote
              return (
                <div className={`reviewer-note-bar ${noteBarOpen ? 'is-open' : ''}`}>
                  <button
                    className="reviewer-note-bar-header"
                    onClick={() => setNoteBarOpen((v) => !v)}
                    type="button"
                  >
                    <span className="reviewer-note-bar-caret">{noteBarOpen ? '▾' : '▸'}</span>
                    <span className="reviewer-note-bar-title">Note</span>
                    {!noteBarOpen && hasNote && (
                      <span className="reviewer-note-bar-preview">
                        {activeTaskNote.split('\n')[0].slice(0, 80)}
                      </span>
                    )}
                    {!noteBarOpen && !hasNote && (
                      <span className="reviewer-note-bar-empty">No note for this task</span>
                    )}
                  </button>
                  {noteBarOpen && (
                    <div
                      key={`${activeTaskId}:${editingNote ? 'edit' : 'view'}`}
                      className="reviewer-note-bar-body"
                    >
                      {editingNote ? (
                        <>
                          <textarea
                            autoFocus
                            className="reviewer-note-textarea"
                            onChange={(e) => setEditNoteText(e.target.value)}
                            rows={3}
                            value={editNoteText}
                          />
                          <div className="reviewer-note-bar-actions">
                            <button
                              className="reviewer-secondary-button"
                              onClick={() => setEditingNote(false)}
                              type="button"
                            >
                              Cancel
                            </button>
                            <button
                              className="reviewer-primary-button"
                              onClick={async () => {
                                await saveActiveTaskNote(editNoteText)
                                setEditingNote(false)
                              }}
                              type="button"
                            >
                              Save note
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="reviewer-note-text">
                            {hasNote ? activeTaskNote : <em>No note yet.</em>}
                          </div>
                          <button
                            className="reviewer-note-edit"
                            onClick={() => {
                              setEditNoteText(activeTaskNote)
                              setEditingNote(true)
                            }}
                            title="Edit note"
                            type="button"
                          >
                            ✎
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}
            <div
              className="reviewer-right-rail-top"
              style={{ flex: `0 0 ${Math.min(Math.max(selectedTrayHeight, 20), 35)}vh` }}
            >
              <SelectedTray
                groupedSelections={groupedSelections}
                hoveredInstanceIds={effectiveHighlight}
                lockedItemIds={lockedItemSet}
                onClearSelected={clearSelected}
                onClickItem={clickItem}
                onDeduplicate={deduplicateSelected}
                onHoverItem={(instanceId) => setHoveredInstanceIds(instanceId ? new Set([instanceId]) : new Set())}
                onRemoveItem={removeItem}
                onUpdateItemText={updateItemText}
                selectedCount={selectedItems.length}
              />
            </div>
            <ResizeHandle heightPercent={selectedTrayHeight} onHeightChange={setSelectedTrayHeight} />
            <div className="reviewer-right-rail-bottom">

            <TurnQueuePanel
              activeTaskId={activeTaskId}
              exportFormat={exportFormat}
              exportText={exportText}
              hoveredInstanceIds={effectiveHighlight}
              onBuildTurns={buildTurns}
              onClickTurn={clickTurn}
              onClearTurns={clearTurns}
              onCopyExport={copyExport}
              onCopyCurrentTurn={copyCurrentTurn}
              onHoverTurn={(turnIndex) => {
                if (turnIndex === null) {
                  setHoveredInstanceIds(new Set())
                  return
                }
                const turn = builtTurns[turnIndex]
                if (!turn) return
                setHoveredInstanceIds(new Set(turn.items.map((i) => i.instanceId)))
              }}
              onDuplicateCopiedTurn={duplicateCopiedTurn}
              onRemoveRemainingTurns={removeRemainingTurns}
              onRemoveTurn={removeTurn}
              onResetCopyProgress={resetCopyProgress}
              onSaveAsTask={openSaveTaskModal}
              onUpdateActiveTask={updateActiveTask}
              onUpdateTurnText={updateTurnText}
              onExportFormatChange={setExportFormat}
              onStartTurnChange={setStartTurn}
              onStrictModeChange={setStrictMode}
              onEndTurnChange={setEndTurn}
              onMinPerTurnChange={setMinPerTurn}
              onMaxPerTurnChange={setMaxPerTurn}
              copyPointer={copyPointer}
              minPerTurn={minPerTurn}
              maxPerTurn={maxPerTurn}
              saveButtonRef={saveButtonRef}
              startTurn={startTurn}
              endTurn={endTurn}
              strictMode={strictMode}
              turnCount={turnCount}
              turns={builtTurns}
              validation={queueValidation}
            />
            </div>
          </div>
        </div>
      )}

      {flyingPill && (
        <div
          className="reviewer-flying-pill"
          style={{
            left: flyingPill.fromRect.left,
            top: flyingPill.fromRect.top,
          }}
        >
          {flyingPill.text}
        </div>
      )}
    </div>
  )
}
