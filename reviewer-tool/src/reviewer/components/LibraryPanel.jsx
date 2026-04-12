import React, { useMemo, useState } from 'react'
import { Check, Plus, Search, Star } from 'lucide-react'
import PromptText from './PromptText'
import { normalizePromptText } from '../utils'

function CustomPromptInput({ subcategory, allPrompts, onAddPrompt, onAddCustom, hasBareUnits }) {
  const [draft, setDraft] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [warning, setWarning] = useState(null) // { existing } when exact match found on submit

  const matches = useMemo(() => {
    const q = draft.trim().toLowerCase()
    if (q.length < 3) return []
    const tokens = q.split(/\s+/).filter(Boolean)
    if (!tokens.length) return []
    const out = []
    for (const p of allPrompts) {
      const hay = `${p.prompt_text} ${p.category_label || ''} ${p.subcategory_label || ''}`.toLowerCase()
      if (tokens.every((t) => hay.includes(t))) {
        out.push(p)
        if (out.length >= 8) break
      }
    }
    return out
  }, [draft, allPrompts])

  const findExactMatch = () => {
    const norm = normalizePromptText(draft).toLowerCase()
    if (!norm) return null
    return allPrompts.find((p) => normalizePromptText(p.prompt_text).toLowerCase() === norm) || null
  }

  const submit = () => {
    const text = draft.trim()
    if (!text) return
    const existing = findExactMatch()
    if (existing) {
      setWarning({ existing })
      setShowDropdown(false)
      return
    }
    onAddCustom(subcategory.id, text)
    setDraft('')
    setWarning(null)
  }

  const pickMatch = (prompt) => {
    onAddPrompt(prompt)
    setDraft('')
    setShowDropdown(false)
    setWarning(null)
  }

  return (
    <>
      <div className="reviewer-subcategory-custom reviewer-subcategory-custom--has-dropdown">
        <div className="reviewer-custom-input-wrap">
          <input
            className="reviewer-subcategory-input"
            onChange={(e) => {
              setDraft(e.target.value)
              setShowDropdown(true)
              setWarning(null)
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submit()
              }
            }}
            placeholder={`Add a custom prompt to ${subcategory.label.toLowerCase()}`}
            type="text"
            value={draft}
          />
          {showDropdown && matches.length > 0 && (
            <ul className="reviewer-custom-dropdown">
              {matches.map((p) => (
                <li
                  key={p.id}
                  className="reviewer-custom-dropdown-item"
                  onMouseDown={(e) => { e.preventDefault(); pickMatch(p) }}
                >
                  <span className="reviewer-custom-dropdown-text">{p.prompt_text}</span>
                  <span className="reviewer-custom-dropdown-meta">
                    {(p.category_label || p.category)} → {(p.subcategory_label || p.subcategory)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button className="reviewer-primary-button" onClick={submit} type="button">Add</button>
      </div>
      <div className="reviewer-custom-hint">
        Wrap variables in curly braces: {'{12pt}'}, {'{Arial}'}, {'{the table}'}.
      </div>
      {draft && hasBareUnits(draft) && (
        <div className="reviewer-custom-warning">
          Consider wrapping values like {'{4pt}'} or {'{1 inch}'} in curly braces so they become editable.
        </div>
      )}
      {warning?.existing && (
        <div className="reviewer-custom-warning reviewer-custom-warning--duplicate">
          <div>
            This prompt already exists in{' '}
            <strong>
              {(warning.existing.category_label || warning.existing.category)}
              {' → '}
              {(warning.existing.subcategory_label || warning.existing.subcategory)}
            </strong>.
          </div>
          <div className="reviewer-custom-warning-actions">
            <button
              className="reviewer-secondary-button"
              onClick={() => {
                onAddPrompt(warning.existing)
                setDraft('')
                setWarning(null)
              }}
              type="button"
            >
              Add existing
            </button>
            <button
              className="reviewer-secondary-button"
              onClick={() => {
                onAddCustom(subcategory.id, draft.trim())
                setDraft('')
                setWarning(null)
              }}
              type="button"
            >
              Add anyway
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function PromptCard({ prompt, isAdded, showCheckbox, starCount, onAddPrompt, onToggleFavorite, onRemovePromptBySourceId }) {
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
        {starCount > 0 && <span className="reviewer-star-count">{starCount}</span>}
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
  starCounts = {},
  allMode = false,
  allPromptsForMatching = [],
}) {
  const [sortByStars, setSortByStars] = useState(true)

  const applyStarSort = (list) => {
    if (!sortByStars) return list
    return [...list].sort((a, b) => (starCounts[b.id] || 0) - (starCounts[a.id] || 0))
  }

  const hasBareUnits = (text) => {
    const stripped = text.replace(/\{[^}]*\}/g, '')
    return /\b\d+(?:\.\d+)?\s*(?:pt|px|em|rem|%|mm|cm|in|inch|inches)\b/i.test(stripped)
  }

  const visibleSubcategories = useMemo(() => {
    const allSubcategories = activeCategory?.subcategories || []
    if (selectedSubcategory === 'all') return allSubcategories
    return allSubcategories.filter((subcategory) => subcategory.id === selectedSubcategory)
  }, [activeCategory, selectedSubcategory])

  const promptsBySubcategory = useMemo(() => (
    Object.fromEntries(
      visibleSubcategories.map((subcategory) => [
        subcategory.id,
        applyStarSort(prompts.filter((prompt) => prompt.subcategory === subcategory.id)),
      ])
    )
  ), [prompts, visibleSubcategories, sortByStars, starCounts])

  const promptsByCategory = useMemo(() => {
    if (!favoritesOnly && !allMode) return []
    const groups = new Map()
    prompts.forEach((prompt) => {
      const key = prompt.category
      const label = prompt.category_label || prompt.category
      if (!groups.has(key)) groups.set(key, { id: key, label, entries: [] })
      groups.get(key).entries.push(prompt)
    })
    const arr = Array.from(groups.values())
    return arr.map((g) => ({ ...g, entries: applyStarSort(g.entries) }))
  }, [prompts, favoritesOnly, allMode, sortByStars, starCounts])

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
          <p>{favoritesOnly
            ? 'Starred prompts across all categories'
            : (allMode
              ? (search.trim() ? 'All categories — search results' : 'Most starred prompts')
              : activeCategoryLabel)}</p>
        </div>
        <span className="reviewer-count-pill">
          {allMode && !favoritesOnly && !search.trim()
            ? `Top ${prompts.length} starred`
            : `${prompts.length} ready`}
        </span>
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

        <div className="reviewer-starred-toggles">
          <button
            className={`reviewer-starred-toggle ${favoritesOnly ? 'is-active' : ''}`}
            onClick={() => onFavoritesOnlyChange(!favoritesOnly)}
            type="button"
            title="Show only starred prompts"
          >
            <Star size={14} fill={favoritesOnly ? 'currentColor' : 'none'} />
            Starred only
          </button>

          <button
            className={`reviewer-starred-toggle ${sortByStars ? 'is-active' : ''}`}
            onClick={() => setSortByStars((v) => !v)}
            type="button"
            title="Sort prompts by total star count"
          >
            Sort by ☆
          </button>
        </div>
      </div>

      <div className="reviewer-library-sections">
        {(favoritesOnly || allMode) ? (
          promptsByCategory.length === 0 ? (
            <div className="reviewer-empty-summary">
              {favoritesOnly
                ? 'No starred prompts yet. Click the ☆ icon on any prompt to star it.'
                : 'No prompts match this search.'}
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
                        showCheckbox={favoritesOnly}
                        starCount={starCounts[prompt.id] || 0}
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
                        starCount={starCounts[prompt.id] || 0}
                        onAddPrompt={onAddPrompt}
                        onRemovePromptBySourceId={onRemovePromptBySourceId}
                        onToggleFavorite={onToggleFavorite}
                      />
                    ))}
                  </div>
                )}

                <CustomPromptInput
                  subcategory={subcategory}
                  allPrompts={allPromptsForMatching}
                  onAddPrompt={onAddPrompt}
                  onAddCustom={onAddCustomPrompt}
                  hasBareUnits={hasBareUnits}
                />
              </section>
            )
          })
        )}
      </div>
    </section>
  )
}
