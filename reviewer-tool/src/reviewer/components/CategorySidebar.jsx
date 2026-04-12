import React from 'react'
import { PRIORITY_LABELS, PRIORITY_ORDER } from '../constants'

export default function CategorySidebar({ categories, counts, selectedCategory, onSelectCategory, totalPromptCount }) {
  return (
    <aside className="reviewer-panel reviewer-sidebar">
      <div className="reviewer-panel-header">
        <div>
          <h2>Categories</h2>
        </div>
      </div>

      <div className="reviewer-list">
        <button
          className={`reviewer-list-item ${selectedCategory === 'all' ? 'is-active' : ''}`}
          onClick={() => onSelectCategory('all')}
          type="button"
        >
          <span className="reviewer-list-item-title">All</span>
          <span className="reviewer-list-item-badge">{totalPromptCount}</span>
        </button>

        {categories.map((category) => {
          const isActive = category.id === selectedCategory
          const selectedCount = counts[category.id] || 0
          return (
            <button
              key={category.id}
              className={`reviewer-list-item ${isActive ? 'is-active' : ''}`}
              onClick={() => onSelectCategory(category.id)}
              type="button"
            >
              <span className="reviewer-list-item-title">{category.label}</span>
              {selectedCount > 0 ? (
                <span className="reviewer-list-item-badge">{selectedCount}</span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="reviewer-panel-divider" />

      <div className="reviewer-panel-header reviewer-panel-header--compact">
        <div>
          <h3>Workflow priority</h3>
          <p>Matches the skill file order</p>
        </div>
      </div>

      <ol className="reviewer-priority-list">
        {PRIORITY_ORDER.map((priority, index) => (
          <li key={priority}>
            <span className="reviewer-priority-index">{index + 1}</span>
            <span>{PRIORITY_LABELS[priority]}</span>
          </li>
        ))}
      </ol>
    </aside>
  )
}
