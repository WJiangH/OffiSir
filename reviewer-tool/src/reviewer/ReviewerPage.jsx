import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CategorySidebar from './components/CategorySidebar'
import ContextPanel from './components/ContextPanel'
import LibraryPanel from './components/LibraryPanel'
import ResizeHandle from './components/ResizeHandle'
import SelectedTray from './components/SelectedTray'
import TaskTabBar from './components/TaskTabBar'
import TurnQueuePanel from './components/TurnQueuePanel'
import {
  buildTwentyTurnQueue,
  createSelectedPrompt,
  exportQueue,
  normalizePromptText,
  promptMatchesDocType,
  sortForTurnBuild,
  sortItems,
  validateQueue,
} from './utils'
import { useUser } from '../lib/UserContext'
import {
  addStar,
  deleteTask as deleteTaskRow,
  fetchCustomPrompts,
  fetchStarCounts,
  fetchUserStars,
  fetchUserTasks,
  insertCustomPrompt,
  insertTask,
  removeStar,
  updateTask as updateTaskRow,
} from '../lib/data'
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
  const loadingTaskRef = useRef(false) // skip turn-clear when loading a task
  const [flashTaskId, setFlashTaskId] = useState(null) // for save animation
  const [flyingPill, setFlyingPill] = useState(null) // { text, fromRect }
  const [hoveredInstanceIds, setHoveredInstanceIds] = useState(new Set())
  const [lockedInstanceIds, setLockedInstanceIds] = useState(new Set())
  const [selectedTrayHeight, setSelectedTrayHeight] = useState(28) // vh units
  const saveButtonRef = useRef(null)
  const newWorkspaceRef = useRef({ selectedItems: [], builtTurns: [], copyPointer: 0 })

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
    // Clear workspace + per-user state whenever user changes (including logout)
    loadingTaskRef.current = true
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
    newWorkspaceRef.current = { selectedItems: [], builtTurns: [], copyPointer: 0 }

    if (!user) return
    let ignore = false
    async function loadSupabase() {
      try {
        const [userStars, counts, custom, tasks] = await Promise.all([
          fetchUserStars(user.id),
          fetchStarCounts(),
          fetchCustomPrompts(),
          fetchUserTasks(user.id),
        ])
        if (ignore) return
        setStars(userStars)
        setStarCounts(counts)
        setCustomPromptsDb(custom)
        setSavedTasks(
          tasks.map((t) => ({
            id: t.id,
            name: t.task_name,
            selectedItems: t.selected_prompts || [],
            builtTurns: t.turns || [],
            copyPointer: t.copy_progress || 0,
            config: t.config || null,
          }))
        )
      } catch (err) {
        if (!ignore) setError(String(err.message || err))
      }
    }
    loadSupabase()
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

  useEffect(() => {
    if (loadingTaskRef.current) {
      loadingTaskRef.current = false
      return
    }
    setBuiltTurns([])
    setCopyPointer(0)
  }, [selectedItems])

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

  const saveAsTask = async () => {
    if (!user) return
    const taskName = `task-${savedTasks.length}`
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
        selectedPrompts: selectedItems,
        turns: builtTurns,
        copyProgress: copyPointer,
        config,
      })
      const newTask = {
        id: row.id,
        name: row.task_name,
        selectedItems: row.selected_prompts || [],
        builtTurns: row.turns || [],
        copyPointer: row.copy_progress || 0,
        config: row.config || null,
      }
      setSavedTasks((current) => [...current, newTask])
      setActiveTaskId(null)
      setBuiltTurns([])
      setCopyPointer(0)
      setTimeout(() => setFlashTaskId(row.id), 600)
      setTimeout(() => setFlashTaskId(null), 1800)
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  const startNewTask = () => {
    loadingTaskRef.current = true
    setActiveTaskId(null)
    setSelectedItems(newWorkspaceRef.current.selectedItems)
    setBuiltTurns(newWorkspaceRef.current.builtTurns)
    setCopyPointer(newWorkspaceRef.current.copyPointer)
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
    loadingTaskRef.current = true
    setActiveTaskId(taskId)
    setSelectedItems(task.selectedItems)
    setBuiltTurns(task.builtTurns)
    setCopyPointer(task.copyPointer || 0)
  }

  const deleteTask = async (taskId) => {
    setSavedTasks((current) => current.filter((t) => t.id !== taskId))
    if (activeTaskId === taskId) {
      loadingTaskRef.current = true
      setActiveTaskId(null)
      setSelectedItems(newWorkspaceRef.current.selectedItems)
      setBuiltTurns(newWorkspaceRef.current.builtTurns)
      setCopyPointer(newWorkspaceRef.current.copyPointer)
    }
    try {
      await deleteTaskRow(taskId)
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  const updateActiveTask = async () => {
    if (activeTaskId === null) return
    setFlashTaskId(activeTaskId)
    setTimeout(() => setFlashTaskId(null), 1200)
    try {
      await updateTaskRow(activeTaskId, {
        selectedPrompts: selectedItems,
        turns: builtTurns,
        copyProgress: copyPointer,
        config: { startTurn, endTurn, minPerTurn, maxPerTurn },
      })
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  const removeRemainingTurns = () => {
    if (copyPointer === 0 || !builtTurns.length) return
    const keptTurns = builtTurns.slice(0, copyPointer)
    const keptItemIds = new Set(
      keptTurns.flatMap((turn) => turn.items.map((item) => item.instanceId))
    )
    const keptSelected = selectedItems.filter((item) => keptItemIds.has(item.instanceId))
    loadingTaskRef.current = true // don't wipe turns on selectedItems change
    setSelectedItems(keptSelected)
    setBuiltTurns(keptTurns)
    setStartTurn((current) => current + copyPointer)
    setCopyPointer(0)
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
        return { ...item, promptText: chunks[idx] }
      })
    )
    // Update the turn itself (non-destructive: update text and item texts)
    loadingTaskRef.current = true
    setBuiltTurns((current) =>
      current.map((t, i) => {
        if (i !== turnIndex) return t
        const newItems = t.items.map((item, idx) => (
          idx < chunks.length ? { ...item, promptText: chunks[idx] } : item
        ))
        return { ...t, items: newItems, text: chunks.join('; ') }
      })
    )
  }

  const copyCurrentTurn = async () => {
    if (!builtTurns.length || copyPointer >= builtTurns.length) return
    const turn = builtTurns[copyPointer]
    if (!turn.text) {
      // Skip empty turns
      setCopyPointer((p) => p + 1)
      return
    }
    try {
      await navigator.clipboard.writeText(turn.text)
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
    setSelectedItems((current) => [...current, createSelectedPrompt(prompt)])
  }

  const removePromptBySourceId = (sourceId) => {
    setSelectedItems((current) => current.filter((item) => item.sourceId !== sourceId))
  }

  const removeItem = (instanceId) => {
    setSelectedItems((current) => current.filter((item) => item.instanceId !== instanceId))
  }

  const selectedSourceIds = useMemo(
    () => new Set(selectedItems.map((item) => item.sourceId).filter(Boolean)),
    [selectedItems]
  )

  const addCustomPrompt = async (subcategoryId, promptText) => {
    if (!user) return
    const normalizedText = normalizePromptText(promptText)
    if (!normalizedText) return

    try {
      const row = await insertCustomPrompt({
        userId: user.id,
        category: selectedCategory,
        subcategory: subcategoryId,
        promptText: normalizedText,
      })
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
      setSelectedItems((current) => [...current, createSelectedPrompt(nextPrompt)])
    } catch (err) {
      setError(String(err.message || err))
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
    setSelectedItems((current) => {
      const seen = new Set()
      return current.filter((item) => {
        const normalized = normalizePromptText(item.promptText).toLowerCase()
        if (seen.has(normalized)) return false
        seen.add(normalized)
        return true
      })
    })
  }

  const clearSelected = () => {
    setSelectedItems([])
  }

  const updateItemText = (instanceId, newText) => {
    setSelectedItems((current) =>
      current.map((item) =>
        item.instanceId === instanceId ? { ...item, promptText: newText } : item
      )
    )
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
    setBuiltTurns([])
    setCopyPointer(0)
  }

  const buildTurns = () => {
    if (selectedItems.length === 0) {
      setBuiltTurns([])
      return
    }

    if (selectedItems.length > turnCount * maxPerTurn) {
      return
    }

    const sortedItems = sortForTurnBuild(selectedItems)
    const nextTurns = buildTwentyTurnQueue(sortedItems, turnCount, minPerTurn, maxPerTurn)

    if (!nextTurns) return

    setBuiltTurns(nextTurns)
    setCopyPointer(0)
  }

  const effectiveHighlight = lockedInstanceIds.size > 0 ? lockedInstanceIds : hoveredInstanceIds

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
            <button onClick={logout} type="button" title="Log out">sign out</button>
          </span>
        )}
      </header>

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
            <div
              className="reviewer-right-rail-top"
              style={{ flex: `0 0 ${Math.min(Math.max(selectedTrayHeight, 20), 35)}vh` }}
            >
              <SelectedTray
                groupedSelections={groupedSelections}
                hoveredInstanceIds={effectiveHighlight}
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
              onRemoveRemainingTurns={removeRemainingTurns}
              onResetCopyProgress={resetCopyProgress}
              onSaveAsTask={saveAsTask}
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
