import React, { useEffect, useMemo, useState } from 'react'
import CategorySidebar from './components/CategorySidebar'
import ContextPanel from './components/ContextPanel'
import LibraryPanel from './components/LibraryPanel'
import SelectedTray from './components/SelectedTray'
import TurnQueuePanel from './components/TurnQueuePanel'
import {
  STRICT_TURN_COUNT,
  WORKFLOW_SUMMARY,
} from './constants'
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
  const [selectedItems, setSelectedItems] = usePersistentState('reviewer_selected_items_v1', [])
  const [favoriteIds, setFavoriteIds] = usePersistentState('reviewer_favorite_prompt_ids_v1', [])
  const [customPrompts, setCustomPrompts] = useSessionState('reviewer_custom_prompts_v1', [])
  const [builtTurns, setBuiltTurns] = useState([])
  const [exportFormat, setExportFormat] = useState('markdown')
  const [statusMessage, setStatusMessage] = useState('')

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
    setBuiltTurns([])
  }, [selectedItems])

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
      if (selectedCategory && prompt.category !== selectedCategory) return false
      if (selectedSubcategory !== 'all' && prompt.subcategory !== selectedSubcategory) return false
      if (!promptMatchesDocType(prompt.doc_type, docTypeFilter)) return false
      if (priorityFilter !== 'all' && prompt.priority !== priorityFilter) return false
      if (favoritesOnly && !prompt.favorite) return false
      if (searchTerm && !buildSearchText(prompt).includes(searchTerm)) return false
      return true
    }),
    librarySort
  )

  const queueValidation = validateQueue(selectedItems, builtTurns, strictMode)
  const exportText = exportQueue(builtTurns, exportFormat, startTurn)

  const addPrompt = (prompt) => {
    setSelectedItems((current) => [...current, createSelectedPrompt(prompt)])
    setStatusMessage(`Added "${prompt.prompt_text}"`)
  }

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
    setStatusMessage('Added custom prompt')
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
    setStatusMessage('Removed duplicate prompts')
  }

  const clearSelected = () => {
    setSelectedItems([])
    setStatusMessage('Cleared selected prompts')
  }

  const updateItemText = (instanceId, newText) => {
    setSelectedItems((current) =>
      current.map((item) =>
        item.instanceId === instanceId ? { ...item, promptText: newText } : item
      )
    )
  }

  const clearTurns = () => {
    setBuiltTurns([])
    setStatusMessage('Cleared export queue')
  }

  const buildTurns = () => {
    if (selectedItems.length === 0) {
      setBuiltTurns([])
      setStatusMessage('Add prompts before building turns')
      return
    }

    if (selectedItems.length > STRICT_TURN_COUNT * 4) {
      setStatusMessage(`Trim the selection to ${STRICT_TURN_COUNT * 4} prompts or fewer`)
      return
    }

    const sortedItems = sortForTurnBuild(selectedItems)
    const nextTurns = buildTwentyTurnQueue(sortedItems)

    if (!nextTurns) {
      setStatusMessage('Could not build the turn queue')
      return
    }

    setBuiltTurns(nextTurns)
    setStatusMessage(`Built ${STRICT_TURN_COUNT} turns`)
  }

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportText)
      setStatusMessage(`Copied ${exportFormat} export`)
    } catch {
      setStatusMessage('Clipboard write failed')
    }
  }

  const downloadExport = () => {
    const extension = exportFormat === 'markdown' ? 'md' : 'txt'
    const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `revision-turn-queue.${extension}`
    anchor.click()
    URL.revokeObjectURL(url)
    setStatusMessage(`Downloaded ${extension} export`)
  }

  return (
    <div className="reviewer-page">
      <section className="reviewer-overview">
        <div>
          <span className="reviewer-eyebrow">Manual review workflow</span>
          <h1>Revision prompt builder</h1>
          <p>
            Built around the Grok Computer Office Trials revise command style:
            manual review, direct local fixes, strict turn queues, and exportable turn text.
          </p>
        </div>

        <div className="reviewer-summary-grid">
          {WORKFLOW_SUMMARY.map((summary) => (
            <article key={summary} className="reviewer-summary-card">
              <p>{summary}</p>
            </article>
          ))}
        </div>
      </section>

      {statusMessage && <div className="reviewer-status-banner">{statusMessage}</div>}
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
          />

          <ContextPanel
            category={activeCategory}
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
            onDocTypeFilterChange={setDocTypeFilter}
            onFavoritesOnlyChange={setFavoritesOnly}
            onLibrarySortChange={setLibrarySort}
            onPriorityFilterChange={setPriorityFilter}
            onSearchChange={setSearch}
            onToggleFavorite={toggleFavorite}
            priorityFilter={priorityFilter}
            prompts={filteredPrompts}
            search={search}
            selectedSubcategory={selectedSubcategory}
          />

          <div className="reviewer-right-rail">
            <SelectedTray
              groupedSelections={groupedSelections}
              onClearSelected={clearSelected}
              onDeduplicate={deduplicateSelected}
              onUpdateItemText={updateItemText}
              selectedCount={selectedItems.length}
            />

            <TurnQueuePanel
              exportFormat={exportFormat}
              exportText={exportText}
              onBuildTurns={buildTurns}
              onClearTurns={clearTurns}
              onCopyExport={copyExport}
              onDownloadExport={downloadExport}
              onExportFormatChange={setExportFormat}
              onStartTurnChange={setStartTurn}
              onStrictModeChange={setStrictMode}
              startTurn={startTurn}
              strictMode={strictMode}
              turns={builtTurns}
              validation={queueValidation}
            />
          </div>
        </div>
      )}
    </div>
  )
}
