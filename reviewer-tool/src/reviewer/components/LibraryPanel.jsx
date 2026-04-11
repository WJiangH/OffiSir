import React, { useMemo, useState } from 'react'
import { Plus, Search, Star } from 'lucide-react'
import { DOC_TYPE_LABELS, LIBRARY_SORT_OPTIONS, PRIORITY_LABELS } from '../constants'
import { formatDocType, formatPriority } from '../utils'
import PromptText from './PromptText'

function PromptCard({ prompt, onAddPrompt, onToggleFavorite }) {
  return (
    <article className="reviewer-library-card reviewer-library-card--inline">
      <p className="reviewer-library-card-text"><PromptText text={prompt.prompt_text} /></p>
      <div className="reviewer-library-card-actions">
        <button
          className={`reviewer-icon-button ${prompt.favorite ? 'is-favorite' : ''}`}
          onClick={() => onToggleFavorite(prompt.id)}
          type="button"
        >
          <Star size={14} />
        </button>
        <button className="reviewer-primary-button" onClick={() => onAddPrompt(prompt)} type="button">
          <Plus size={14} />
          Add
        </button>
      </div>
    </article>
  )
}

export default function LibraryPanel({
  activeCategory,
  activeCategoryLabel,
  prompts,
  search,
  onSearchChange,
  docTypeFilter,
  onDocTypeFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  favoritesOnly,
  onFavoritesOnlyChange,
  librarySort,
  onLibrarySortChange,
  onAddPrompt,
  onToggleFavorite,
  selectedSubcategory,
  onAddCustomPrompt,
}) {
  const [drafts, setDrafts] = useState({})

  const visibleSubcategories = useMemo(() => {
    const allSubcategories = activeCategory?.subcategories || []
    if (selectedSubcategory === 'all') return allSubcategories
    return allSubcategories.filter((subcategory) => subcategory.id === selectedSubcategory)
  }, [activeCategory, selectedSubcategory])

  const promptsBySubcategory = useMemo(() => (
    Object.fromEntries(
      visibleSubcategories.map((subcategory) => [
        subcategory.id,
        prompts.filter((prompt) => prompt.subcategory === subcategory.id),
      ])
    )
  ), [prompts, visibleSubcategories])

  const handleAddCustomPrompt = (subcategory) => {
    const draftText = drafts[subcategory.id]?.trim()
    if (!draftText) return

    onAddCustomPrompt(subcategory.id, draftText)
    setDrafts((current) => ({ ...current, [subcategory.id]: '' }))
  }

  return (
    <section className="reviewer-panel reviewer-library-panel">
      <div className="reviewer-panel-header">
        <div>
          <h2>Prompt library</h2>
          <p>{activeCategoryLabel}</p>
        </div>
        <span className="reviewer-count-pill">{prompts.length} ready</span>
      </div>

      <div className="reviewer-filter-grid">
        <label className="reviewer-input-shell reviewer-search-shell">
          <Search size={15} />
          <input
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search prompt text, tags, and subcategories"
            type="search"
            value={search}
          />
        </label>

        <select className="reviewer-select" onChange={(event) => onDocTypeFilterChange(event.target.value)} value={docTypeFilter}>
          <option value="all">All doc types</option>
          {Object.entries(DOC_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select className="reviewer-select" onChange={(event) => onPriorityFilterChange(event.target.value)} value={priorityFilter}>
          <option value="all">All priorities</option>
          {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select className="reviewer-select" onChange={(event) => onLibrarySortChange(event.target.value)} value={librarySort}>
          {LIBRARY_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label className="reviewer-checkbox">
          <input checked={favoritesOnly} onChange={(event) => onFavoritesOnlyChange(event.target.checked)} type="checkbox" />
          Favorites only
        </label>
      </div>

      <div className="reviewer-library-sections">
        {visibleSubcategories.map((subcategory) => {
          const sectionPrompts = promptsBySubcategory[subcategory.id] || []

          return (
            <section key={subcategory.id} className="reviewer-subcategory-section">
              <div className="reviewer-subcategory-header">
                <div>
                  <h3>{subcategory.label}</h3>
                  <p>{subcategory.description}</p>
                </div>
                <span className="reviewer-count-pill">{sectionPrompts.length}</span>
              </div>

              {sectionPrompts.length === 0 ? (
                <div className="reviewer-empty-summary reviewer-empty-summary--compact">
                  No prompts match these filters
                </div>
              ) : (
                <div className="reviewer-library-list">
                  {sectionPrompts.map((prompt) => (
                    <PromptCard key={prompt.id} onAddPrompt={onAddPrompt} onToggleFavorite={onToggleFavorite} prompt={prompt} />
                  ))}
                </div>
              )}

              <div className="reviewer-subcategory-custom">
                <input
                  className="reviewer-subcategory-input"
                  onChange={(event) => setDrafts((current) => ({ ...current, [subcategory.id]: event.target.value }))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      handleAddCustomPrompt(subcategory)
                    }
                  }}
                  placeholder={`Add a custom prompt to ${subcategory.label.toLowerCase()}`}
                  type="text"
                  value={drafts[subcategory.id] || ''}
                />
                <button className="reviewer-primary-button" onClick={() => handleAddCustomPrompt(subcategory)} type="button">
                  Add
                </button>
              </div>
            </section>
          )
        })}
      </div>
    </section>
  )
}
