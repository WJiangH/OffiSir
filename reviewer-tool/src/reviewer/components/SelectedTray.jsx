import React from 'react'
import { X } from 'lucide-react'
import EditablePromptText from './EditablePromptText'

export default function SelectedTray({
  groupedSelections,
  selectedCount,
  hoveredInstanceIds,
  onDeduplicate,
  onClearSelected,
  onHoverItem,
  onClickItem,
  onRemoveItem,
  onUpdateItemText,
}) {
  return (
    <section className="reviewer-panel reviewer-right-panel">
      <div className="reviewer-panel-header">
        <div>
          <h2>Selected prompts</h2>
          <p>Click highlighted values to edit them</p>
        </div>
        <span className="reviewer-count-pill">{selectedCount}</span>
      </div>

      <div className="reviewer-toolbar reviewer-toolbar--summary">
        <button className="reviewer-secondary-button" onClick={onDeduplicate} type="button">
          Deduplicate
        </button>
        <button className="reviewer-secondary-button" onClick={onClearSelected} type="button">
          Clear selected
        </button>
      </div>

      {groupedSelections.length === 0 ? (
        <div className="reviewer-empty-summary">
          Add prompts from the library to build the export queue
        </div>
      ) : (
        <div className="reviewer-summary-list">
          {groupedSelections.map((group) => (
            <section key={group.id} className="reviewer-summary-group">
              <div className="reviewer-summary-group-header">
                <h3>{group.label}</h3>
                <span className="reviewer-count-pill">{group.items.length}</span>
              </div>

              <ol className="reviewer-summary-ol">
                {group.items.map((item) => (
                  <li
                    key={item.instanceId}
                    className={hoveredInstanceIds?.has(item.instanceId) ? 'is-linked' : ''}
                    onMouseEnter={() => onHoverItem && onHoverItem(item.instanceId)}
                    onMouseLeave={() => onHoverItem && onHoverItem(null)}
                    onClick={(e) => {
                      e.stopPropagation()
                      onClickItem && onClickItem(item.instanceId)
                    }}
                  >
                    <div className="reviewer-summary-item">
                      <div className="reviewer-summary-item-text">
                        <EditablePromptText
                          text={item.promptText}
                          onTextChange={(newText) => onUpdateItemText(item.instanceId, newText)}
                        />
                      </div>
                      <button
                        className="reviewer-summary-item-remove"
                        onClick={() => onRemoveItem && onRemoveItem(item.instanceId)}
                        title="Remove this prompt"
                        type="button"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}
