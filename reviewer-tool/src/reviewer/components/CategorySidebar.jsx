import React, { useState } from 'react'
import { PRIORITY_LABELS, PRIORITY_ORDER } from '../constants'

export default function CategorySidebar({
  categories,
  counts,
  selectedCategory,
  onSelectCategory,
  totalPromptCount,
  priorityOrder,
  onReorderPriority,
  onResetPriority,
}) {
  const order = priorityOrder && priorityOrder.length > 0 ? priorityOrder : PRIORITY_ORDER
  const [dragIndex, setDragIndex] = useState(null)
  const [overIndex, setOverIndex] = useState(null)

  const isCustom = JSON.stringify(order) !== JSON.stringify(PRIORITY_ORDER)

  const handleDragStart = (index) => (e) => {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    // Firefox requires setData to initiate drag
    try { e.dataTransfer.setData('text/plain', String(index)) } catch {}
  }

  const handleDragOver = (index) => (e) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return
    if (overIndex !== index) setOverIndex(index)
  }

  const handleDrop = (index) => (e) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null)
      setOverIndex(null)
      return
    }
    const next = [...order]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(index, 0, moved)
    setDragIndex(null)
    setOverIndex(null)
    if (onReorderPriority) onReorderPriority(next)
  }

  const handleDragEnd = () => {
    setDragIndex(null)
    setOverIndex(null)
  }

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
          <p>Drag to reorder · Build uses this order</p>
        </div>
      </div>

      <ol className="reviewer-priority-list">
        {order.map((priority, index) => {
          const label = PRIORITY_LABELS[priority] || priority
          const classes = [
            'reviewer-priority-item',
            dragIndex === index ? 'is-dragging' : '',
            overIndex === index && dragIndex !== null && dragIndex !== index ? 'is-drop-target' : '',
          ].filter(Boolean).join(' ')
          return (
            <li
              key={priority}
              className={classes}
              draggable
              onDragStart={handleDragStart(index)}
              onDragOver={handleDragOver(index)}
              onDrop={handleDrop(index)}
              onDragEnd={handleDragEnd}
              onDragLeave={() => { if (overIndex === index) setOverIndex(null) }}
              title="Drag to reorder"
            >
              <span className="reviewer-priority-handle" aria-hidden="true">⋮⋮</span>
              <span className="reviewer-priority-index">{index + 1}</span>
              <span className="reviewer-priority-label">{label}</span>
            </li>
          )
        })}
      </ol>

      {onResetPriority && (
        <button
          className="reviewer-priority-reset"
          disabled={!isCustom}
          onClick={onResetPriority}
          type="button"
          title={isCustom ? 'Reset workflow priority to the default order' : 'Already at default order'}
        >
          Default
        </button>
      )}
    </aside>
  )
}
