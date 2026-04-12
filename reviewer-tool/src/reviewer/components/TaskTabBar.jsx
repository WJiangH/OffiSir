import React from 'react'
import { Plus, X } from 'lucide-react'

export default function TaskTabBar({ tasks, activeTaskId, flashTaskId, onSwitchTask, onNewTask, onDeleteTask }) {
  if (tasks.length === 0 && activeTaskId === null) return null

  return (
    <div className="reviewer-task-tabs">
      {tasks.map((task) => {
        const total = task.builtTurns?.length || 0
        const copied = task.copyPointer || 0
        return (
          <div
            key={task.id}
            className={[
              'reviewer-task-tab',
              task.id === activeTaskId ? 'is-active' : '',
              task.id === flashTaskId ? 'is-flashing' : '',
            ].join(' ')}
            role="button"
            onClick={() => onSwitchTask(task.id)}
          >
            <span className="reviewer-task-tab-name">{task.name}</span>
            <span className="reviewer-task-tab-dot">·</span>
            <span className="reviewer-task-tab-count">{copied}/{total}</span>
            <button
              className="reviewer-task-tab-close"
              onClick={(e) => {
                e.stopPropagation()
                onDeleteTask(task.id)
              }}
              title="Delete task"
              type="button"
            >
              <X size={12} />
            </button>
          </div>
        )
      })}
      <button
        className={`reviewer-task-tab reviewer-task-tab--new ${activeTaskId === null ? 'is-active' : ''}`}
        onClick={onNewTask}
        type="button"
      >
        <Plus size={14} />
        New
      </button>
    </div>
  )
}
