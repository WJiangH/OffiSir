import React, { useMemo, useState } from 'react'
import { Check, Plus, Search, Star } from 'lucide-react'
import PromptText from './PromptText'

function PromptCard({ prompt, isAdded, showCheckbox, onAddPrompt, onToggleFavorite, onRemovePromptBySourceId }) {
  return (
    <article className={`reviewer-library-card reviewer-library-card--inline ${isAdded ? 'is-added' : ''}`}>
      {showCheckbox && (
        <label className="reviewer-library-checkbox">
          <input
            type="checkbox"
            checked={isAdded}
            onChange={(e) => {
              if (e.target.checked) onAddPrompt(prompt)
              else onRemovePromptBySourceId(prompt.id)
            }}
          />
        </label>
      )}
      <p className="reviewer-library-card-text"><PromptText text={prompt.prompt_text} /></p>
      <div className="reviewer-library-card-actions">
        <button
          className={`reviewer-icon-button ${prompt.favorite ? 'is-favorite' : ''}`}
          onClick={() => onToggleFavorite(prompt.id)}
          type="button"
        >
          <Star size={14} fill={prompt.favorite ? 'currentColor' : 'none'} />
        </button>
        <button
          className={`reviewer-primary-button ${isAdded ? 'is-added' : ''}`}
          onClick={() => onAddPrompt(prompt)}
          type="button"
        >
          {isAdded ? <Check size={14} /> : <Plus size={14} />}
          {isAdded ? 'Added' : 'Add'}
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
  favoritesOnly,
  onFavoritesOnlyChange,
  onAddPrompt,
  onRemovePromptBySourceId,
  onToggleFavorite,
  selectedSourceIds,
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

  const promptsByCategory = useMemo(() => {
    if (!favoritesOnly) return []
    const groups = new Map()
    prompts.forEach((prompt) => {
      const key = prompt.category
      const label = prompt.category_label || prompt.category
      if (!groups.has(key)) groups.set(key, { id: key, label, entries: [] })
      groups.get(key).entries.push(prompt)
    })
    return Array.from(groups.values())
  }, [prompts, favoritesOnly])

  const handleAddCustomPrompt = (subcategory) => {
    const draftText = drafts[subcategory.id]?.trim()
    if (!draftText) return
    onAddCustomPrompt(subcategory.id, draftText)
    setDrafts((current) => ({ ...current, [subcategory.id]: '' }))
  }

  const handleAddAll = (entries) => {
    entries.forEach((prompt) => {
      if (!selectedSourceIds?.has(prompt.id)) onAddPrompt(prompt)
    })
  }

  return (
    <section className="reviewer-panel reviewer-library-panel">
      <div className="reviewer-panel-header">
        <div>
          <h2>Prompt library</h2>
          <p>{favoritesOnly ? 'Starred prompts across all categories' : activeCategoryLabel}</p>
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

        <button
          className={`reviewer-starred-toggle ${favoritesOnly ? 'is-active' : ''}`}
          onClick={() => onFavoritesOnlyChange(!favoritesOnly)}
          type="button"
          title="Show only starred prompts"
        >
          <Star size={14} fill={favoritesOnly ? 'currentColor' : 'none'} />
          Starred only
        </button>
      </div>

      <div className="reviewer-library-sections">
        {favoritesOnly ? (
          promptsByCategory.length === 0 ? (
            <div className="reviewer-empty-summary">
              No starred prompts yet. Click the ☆ icon on any prompt to star it.
            </div>
          ) : (
            promptsByCategory.map((group) => {
              const allAdded = group.entries.every((p) => selectedSourceIds?.has(p.id))
              return (
                <section key={group.id} className="reviewer-subcategory-section">
                  <div className="reviewer-subcategory-header">
                    <div>
                      <h3>{group.label}</h3>
                    </div>
                    <div className="reviewer-subcategory-header-actions">
                      <span className="reviewer-count-pill">{group.entries.length}</span>
                      <button
                        className="reviewer-secondary-button reviewer-add-all-button"
                        disabled={allAdded}
                        onClick={() => handleAddAll(group.entries)}
                        type="button"
                      >
                        <Plus size={14} />
                        {allAdded ? 'All added' : 'Add all'}
                      </button>
                    </div>
                  </div>
                  <div className="reviewer-library-list">
                    {group.entries.map((prompt) => (
                      <PromptCard
                        key={prompt.id}
                        prompt={prompt}
                        isAdded={selectedSourceIds?.has(prompt.id)}
                        showCheckbox={true}
                        onAddPrompt={onAddPrompt}
                        onRemovePromptBySourceId={onRemovePromptBySourceId}
                        onToggleFavorite={onToggleFavorite}
                      />
                    ))}
                  </div>
                </section>
              )
            })
          )
        ) : (
          visibleSubcategories.map((subcategory) => {
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
                      <PromptCard
                        key={prompt.id}
                        prompt={prompt}
                        isAdded={selectedSourceIds?.has(prompt.id)}
                        showCheckbox={false}
                        onAddPrompt={onAddPrompt}
                        onRemovePromptBySourceId={onRemovePromptBySourceId}
                        onToggleFavorite={onToggleFavorite}
                      />
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
          })
        )}
      </div>
    </section>
  )
}
