import React, { useState } from 'react'
import { Plus } from 'lucide-react'

export default function ContextPanel({
  category,
  selectedSubcategory,
  onSelectSubcategory,
  subcategoryCounts,
  totalCount,
  onAddSubcategory,
  isAllSelected,
  onAddCategory,
}) {
  const subcategories = category?.subcategories || []
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  const handleAdd = () => {
    const name = draft.trim()
    if (!name) return
    if (isAllSelected) onAddCategory(name)
    else onAddSubcategory(name)
    setDraft('')
    setAdding(false)
  }

  const addLabel = isAllSelected ? 'Add category' : 'Add subcategory'
  const inputPlaceholder = isAllSelected ? 'Category name' : 'Subcategory name'

  return (
    <aside className="reviewer-panel reviewer-sidebar">
      <div className="reviewer-panel-header">
        <div>
          <h2>{isAllSelected ? 'Categories' : 'Subcategories'}</h2>
          {!isAllSelected && <p>{category?.label || 'Choose a category'}</p>}
        </div>
      </div>

      {!isAllSelected && (
        <div className="reviewer-list">
          <button
            className={`reviewer-list-item ${selectedSubcategory === 'all' ? 'is-active' : ''}`}
            onClick={() => onSelectSubcategory('all')}
            type="button"
          >
            <span className="reviewer-list-item-title">All prompts</span>
            <span className="reviewer-list-item-meta">{totalCount}</span>
          </button>

          {subcategories.map((subcategory) => {
            const isActive = subcategory.id === selectedSubcategory
            return (
              <button
                key={subcategory.id}
                className={`reviewer-list-item ${isActive ? 'is-active' : ''}`}
                onClick={() => onSelectSubcategory(subcategory.id)}
                type="button"
              >
                <div>
                  <span className="reviewer-list-item-title">{subcategory.label}</span>
                  <p className="reviewer-list-item-copy">{subcategory.description}</p>
                </div>
                <span className="reviewer-list-item-meta">{subcategoryCounts[subcategory.id] || 0}</span>
              </button>
            )
          })}
        </div>
      )}

      {!isAllSelected && <div className="reviewer-panel-divider" />}

      {adding ? (
        <div className="reviewer-add-subcategory">
          <input
            autoFocus
            className="reviewer-subcategory-input"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd()
              if (e.key === 'Escape') { setAdding(false); setDraft('') }
            }}
            placeholder={inputPlaceholder}
            type="text"
            value={draft}
          />
          <button className="reviewer-primary-button" onClick={handleAdd} type="button">Add</button>
          <button className="reviewer-secondary-button" onClick={() => { setAdding(false); setDraft('') }} type="button">Cancel</button>
        </div>
      ) : (
        <button className="reviewer-add-subcategory-trigger" onClick={() => setAdding(true)} type="button">
          <Plus size={14} />
          {addLabel}
        </button>
      )}
    </aside>
  )
}
