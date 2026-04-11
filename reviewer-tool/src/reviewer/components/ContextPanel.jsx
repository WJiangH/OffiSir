import React from 'react'

export default function ContextPanel({
  category,
  selectedSubcategory,
  onSelectSubcategory,
  subcategoryCounts,
  totalCount,
}) {
  const subcategories = category?.subcategories || []

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
    </aside>
  )
}
