import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CategorySidebar from './components/CategorySidebar'
import ContextPanel from './components/ContextPanel'
import LibraryPanel from './components/LibraryPanel'
import ResizeHandle from './components/ResizeHandle'
import SelectedTray from './components/SelectedTray'
import TaskTabBar from './components/TaskTabBar'
import TurnQueuePanel from './components/TurnQueuePanel'
import usePersistentState from './usePersistentState'
import useSessionState from './useSessionState'
import {
  buildTwentyTurnQueue,
  createSelectedPrompt,
  exportQueue,
  makeCustomPromptId,
  normalizePromptText,
  promptMatchesDocType,
  sortForTurnBuild,
  sortItems,
  validateQueue,
} from './utils'
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
  const [categories, setCategories] = useState([])
  const [basePrompts, setBasePrompts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedSubcategory, setSelectedSubcategory] = useState('all')
  const [docTypeFilter, setDocTypeFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [librarySort, setLibrarySort] = useState('priority')
  const [strictMode, setStrictMode] = usePersistentState('reviewer_strict_mode_v1', true)
  const [startTurn, setStartTurn] = usePersistentState('reviewer_start_turn_v1', 2)
  const [endTurn, setEndTurn] = usePersistentState('reviewer_end_turn_v1', 20)
  const [minPerTurn, setMinPerTurn] = usePersistentState('reviewer_min_per_turn_v1', 3)
  const [maxPerTurn, setMaxPerTurn] = usePersistentState('reviewer_max_per_turn_v1', 6)
  const [selectedItems, setSelectedItems] = usePersistentState('reviewer_selected_items_v1', [])
  const [favoriteIds, setFavoriteIds] = usePersistentState('reviewer_favorite_prompt_ids_v1', [])
  const [customPrompts, setCustomPrompts] = useSessionState('reviewer_custom_prompts_v1', [])
  const [builtTurns, setBuiltTurns] = useState([])
  const [exportFormat, setExportFormat] = useState('markdown')
  const [savedTasks, setSavedTasks] = useState([])
  const [activeTaskId, setActiveTaskId] = useState(null)
  const [copyPointer, setCopyPointer] = useState(0) // index into builtTurns
  const loadingTaskRef = useRef(false) // skip turn-clear when loading a task
  const [flashTaskId, setFlashTaskId] = useState(null) // for save animation
  const [flyingPill, setFlyingPill] = useState(null) // { text, fromRect }
  const [hoveredInstanceIds, setHoveredInstanceIds] = useState(new Set())
  const [selectedTrayHeight, setSelectedTrayHeight] = usePersistentState('reviewer_tray_height_v2', 28) // vh units
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
        setSelectedCategory((current) => current || categoriesResponse[0]?.id || '')
      } catch (loadError) {
        if (!ignore) setError(String(loadError))
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    loadData()

    return () => { ignore = true }
  }, [])

  useEffect(() => {
    if (!categories.length) return
    if (!categories.some((category) => category.id === selectedCategory)) {
      setSelectedCategory(categories[0].id)
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

  const saveAsTask = () => {
    const nextId = savedTasks.length
    const taskName = `task-${nextId}`
    const count = selectedItems.length
    const newTask = {
      id: nextId,
      name: taskName,
      selectedItems: [...selectedItems],
      builtTurns: [...builtTurns],
      copyPointer,
    }

    // Launch flying pill animation from the Save button to the tab bar
    if (saveButtonRef.current) {
      const rect = saveButtonRef.current.getBoundingClientRect()
      setFlyingPill({ text: `${taskName} · ${count}`, fromRect: rect })
      setTimeout(() => setFlyingPill(null), 700)
    }

    setSavedTasks((current) => [...current, newTask])
    setActiveTaskId(null)
    setBuiltTurns([])
    setCopyPointer(0)
    // Flash the new tab after the pill lands
    setTimeout(() => setFlashTaskId(nextId), 600)
    setTimeout(() => setFlashTaskId(null), 1800)
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

  const deleteTask = (taskId) => {
    setSavedTasks((current) => current.filter((t) => t.id !== taskId))
    if (activeTaskId === taskId) {
      // Fall back to new workspace
      loadingTaskRef.current = true
      setActiveTaskId(null)
      setSelectedItems(newWorkspaceRef.current.selectedItems)
      setBuiltTurns(newWorkspaceRef.current.builtTurns)
      setCopyPointer(newWorkspaceRef.current.copyPointer)
    }
  }

  const updateActiveTask = () => {
    if (activeTaskId === null) return
    // Auto-save effect already mirrors state, so just flash the tab
    setFlashTaskId(activeTaskId)
    setTimeout(() => setFlashTaskId(null), 1200)
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

  const prompts = useMemo(() => [...basePrompts, ...customPrompts], [basePrompts, customPrompts])
  const favoriteSet = new Set(favoriteIds)
  const activeCategory = categories.find((category) => category.id === selectedCategory)
  const categoryLookup = Object.fromEntries(categories.map((category) => [category.id, category]))

  const promptsWithLabels = useMemo(() => (
    prompts.map((prompt) => ({
      ...prompt,
      favorite: favoriteSet.has(prompt.id) || Boolean(prompt.favorite),
      category_label: categoryLookup[prompt.category]?.label || prompt.category,
      subcategory_label: categoryLookup[prompt.category]?.subcategories?.find((subcategory) => subcategory.id === prompt.subcategory)?.label || prompt.subcategory,
    }))
  ), [prompts, favoriteSet, categoryLookup])

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

  const addCustomPrompt = (subcategoryId, promptText) => {
    const normalizedText = normalizePromptText(promptText)
    if (!normalizedText) return

    const referencePrompt = promptsWithLabels.find((prompt) => (
      prompt.category === selectedCategory && prompt.subcategory === subcategoryId
    ))

    const nextPrompt = {
      id: makeCustomPromptId(),
      category: selectedCategory,
      subcategory: subcategoryId,
      prompt_text: normalizedText,
      priority: referencePrompt?.priority || activeCategory?.priority_group || 'polish',
      doc_type: referencePrompt?.doc_type || 'both',
      tags: [...new Set([...(referencePrompt?.tags || []), 'custom'])],
      favorite: false,
      active: true,
      custom: true,
    }

    setCustomPrompts((current) => [...current, nextPrompt])
    setSelectedItems((current) => [...current, createSelectedPrompt(nextPrompt)])
  }

  const toggleFavorite = (promptId) => {
    setFavoriteIds((current) => {
      if (current.includes(promptId)) return current.filter((id) => id !== promptId)
      return [...current, promptId]
    })
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

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportText)
    } catch {
      // clipboard failed
    }
  }

  return (
    <div className="reviewer-page">
      <header className="reviewer-header">
        <h1>OffiSir</h1>
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
            prompts={filteredPrompts}
            search={search}
            selectedSourceIds={selectedSourceIds}
            selectedSubcategory={selectedSubcategory}
          />

          <div className="reviewer-right-rail">
            <div
              className="reviewer-right-rail-top"
              style={{ flex: `0 0 ${Math.min(Math.max(selectedTrayHeight, 20), 35)}vh` }}
            >
              <SelectedTray
                groupedSelections={groupedSelections}
                hoveredInstanceIds={hoveredInstanceIds}
                onClearSelected={clearSelected}
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
              hoveredInstanceIds={hoveredInstanceIds}
              onBuildTurns={buildTurns}
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
