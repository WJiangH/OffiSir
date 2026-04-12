import React, { useState } from 'react'
import { Plus } from 'lucide-react'

export default function ContextPanel({
  category,
  selectedSubcategory,
  onSelectSubcategory,
  subcategoryCounts,
  totalCount,
  onAddSubcategory,
}) {
  const subcategories = category?.subcategories || []
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  const handleAdd = () => {
    const name = draft.trim()
    if (!name) return
    onAddSubcategory(name)
    setDraft('')
    setAdding(false)
  }

  return (
    <aside className="reviewer-panel reviewer-sidebar">
      <div className="reviewer-panel-header">
        <div>
          <h2>Subcategories</h2>
          <p>{category?.label || 'Choose a category'}</p>
        </div>
      </div>

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

      <div className="reviewer-panel-divider" />

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
            placeholder="Subcategory name"
            type="text"
            value={draft}
          />
          <button className="reviewer-primary-button" onClick={handleAdd} type="button">Add</button>
          <button className="reviewer-secondary-button" onClick={() => { setAdding(false); setDraft('') }} type="button">Cancel</button>
        </div>
      ) : (
        <button className="reviewer-add-subcategory-trigger" onClick={() => setAdding(true)} type="button">
          <Plus size={14} />
          Add subcategory
        </button>
      )}
    </aside>
  )
}
