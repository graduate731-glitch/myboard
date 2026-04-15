import { useState, useEffect, useCallback } from 'react'
import './App.css'

// ===== Utility =====
function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])
  return [value, setValue]
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function isThisWeek(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)
  return d >= startOfWeek && d <= endOfWeek
}

function isThisMonth(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

const PRIORITIES = ['高', '中', '低']
const CATEGORIES = ['本業', '副業', '休日', 'その他']

function priorityStyle(priority, part) {
  const map = {
    高: { line: 'var(--priority-high-line)', bg: 'var(--priority-high-bg)', text: 'var(--priority-high-text)' },
    中: { line: 'var(--priority-mid-line)',  bg: 'var(--priority-mid-bg)',  text: 'var(--priority-mid-text)'  },
    低: { line: 'var(--priority-low-line)',  bg: 'var(--priority-low-bg)',  text: 'var(--priority-low-text)'  },
  }
  return map[priority]?.[part] ?? '#ccc'
}

// ===== TaskItem =====
function TaskItem({ task, onToggle, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(task.text)
  const [editPriority, setEditPriority] = useState(task.priority)
  const [editCategory, setEditCategory] = useState(
    CATEGORIES.includes(task.category) ? task.category : 'その他'
  )
  const [editCategoryCustom, setEditCategoryCustom] = useState(
    CATEGORIES.includes(task.category) ? '' : task.category
  )

  const handleSave = () => {
    const cat = editCategory === 'その他' && editCategoryCustom.trim()
      ? editCategoryCustom.trim()
      : editCategory
    onEdit(task.id, { text: editText, priority: editPriority, category: cat })
    setEditing(false)
  }

  return (
    <div
      className={`task-item${task.done ? ' done' : ''}`}
      style={{ borderLeftColor: priorityStyle(task.priority, 'line') }}
    >
      {/* Complete button */}
      <button
        className={`task-check${task.done ? ' checked' : ''}`}
        onClick={() => onToggle(task.id)}
        title={task.done ? '未完了に戻す' : '完了にする'}
      >
        {task.done && <CheckIcon />}
      </button>

      <div className="task-body">
        {editing ? (
          <div className="task-edit-form">
            <input
              className="task-edit-input"
              value={editText}
              onChange={e => setEditText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              autoFocus
            />
            <div className="task-edit-row">
              <select
                className="select-sm"
                value={editPriority}
                onChange={e => setEditPriority(e.target.value)}
              >
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
              <select
                className="select-sm"
                value={editCategory}
                onChange={e => setEditCategory(e.target.value)}
              >
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              {editCategory === 'その他' && (
                <input
                  className="select-sm"
                  placeholder="カテゴリ名"
                  value={editCategoryCustom}
                  onChange={e => setEditCategoryCustom(e.target.value)}
                  style={{ width: 100 }}
                />
              )}
              <button className="btn-save" onClick={handleSave}>保存</button>
              <button className="btn-cancel" onClick={() => setEditing(false)}>キャンセル</button>
            </div>
          </div>
        ) : (
          <div className="task-main">
            <span className="task-text">{task.text}</span>
            <div className="task-meta">
              <span
                className="badge-priority"
                style={{
                  background: priorityStyle(task.priority, 'bg'),
                  color: priorityStyle(task.priority, 'text'),
                }}
              >
                {task.priority}
              </span>
              <span className="badge-category">{task.category}</span>
            </div>
          </div>
        )}
      </div>

      {!editing && (
        <div className="task-actions">
          <button className="btn-icon" onClick={() => setEditing(true)} title="編集">
            <PencilIcon />
          </button>
          <button className="btn-icon btn-delete" onClick={() => onDelete(task.id)} title="削除">
            <XIcon />
          </button>
        </div>
      )}
    </div>
  )
}

// ===== TaskBoard =====
function TaskBoard({ tasks, onAdd, onToggle, onEdit, onDelete }) {
  const [text, setText] = useState('')
  const [priority, setPriority] = useState('中')
  const [category, setCategory] = useState('本業')
  const [categoryCustom, setCategoryCustom] = useState('')

  const [filterDate, setFilterDate] = useState('全て')
  const [filterPriority, setFilterPriority] = useState('全て')
  const [filterStatus, setFilterStatus] = useState('全て')

  const handleAdd = () => {
    if (!text.trim()) return
    const cat = category === 'その他' && categoryCustom.trim()
      ? categoryCustom.trim()
      : category
    onAdd({ text: text.trim(), priority, category: cat })
    setText('')
    setCategoryCustom('')
  }

  const filtered = tasks.filter(t => {
    // Date filter
    if (filterDate === '今日' && t.date !== todayStr()) return false
    if (filterDate === '今週' && !isThisWeek(t.date)) return false
    if (filterDate === '今月' && !isThisMonth(t.date)) return false
    // Priority filter
    if (filterPriority !== '全て' && t.priority !== filterPriority) return false
    // Status filter
    if (filterStatus === '済' && !t.done) return false
    if (filterStatus === '未' && t.done) return false
    return true
  })

  return (
    <div className="board">
      {/* Add form */}
      <div className="add-form">
        <input
          className="add-input"
          placeholder="タスクを入力..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <div className="add-form-row">
          <select className="select-sm" value={priority} onChange={e => setPriority(e.target.value)}>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
          <select className="select-sm" value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          {category === 'その他' && (
            <input
              className="select-sm"
              placeholder="カテゴリ名"
              value={categoryCustom}
              onChange={e => setCategoryCustom(e.target.value)}
              style={{ width: 110 }}
            />
          )}
          <button className="btn-add" onClick={handleAdd}>追加</button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <FilterGroup
          label="日付"
          options={['全て', '今日', '今週', '今月']}
          value={filterDate}
          onChange={setFilterDate}
        />
        <FilterGroup
          label="優先度"
          options={['全て', '高', '中', '低']}
          value={filterPriority}
          onChange={setFilterPriority}
        />
        <FilterGroup
          label="状況"
          options={['全て', '未', '済']}
          value={filterStatus}
          onChange={setFilterStatus}
        />
      </div>

      {/* Task list */}
      <div className="task-list">
        {filtered.length === 0 ? (
          <div className="empty-state">タスクはありません</div>
        ) : (
          filtered.map(t => (
            <TaskItem
              key={t.id}
              task={t}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  )
}

function FilterGroup({ label, options, value, onChange }) {
  return (
    <div className="filter-group">
      <span className="filter-label">{label}</span>
      {options.map(opt => (
        <button
          key={opt}
          className={`filter-btn${value === opt ? ' active' : ''}`}
          onClick={() => onChange(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

// ===== IdeaBoard =====
function IdeaBoard({ memos, onAdd, onDelete }) {
  const [text, setText] = useState('')

  const handleAdd = () => {
    if (!text.trim()) return
    onAdd(text.trim())
    setText('')
  }

  return (
    <div className="board">
      <div className="add-form">
        <textarea
          className="idea-input"
          placeholder="アイデアを入力..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleAdd())}
          rows={3}
        />
        <div className="add-form-row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn-add" onClick={handleAdd}>保存</button>
        </div>
      </div>

      <div className="memo-list">
        {memos.length === 0 ? (
          <div className="empty-state">メモはありません</div>
        ) : (
          memos.map(m => (
            <div key={m.id} className="memo-item">
              <p className="memo-text">{m.text}</p>
              <div className="memo-footer">
                <span className="memo-date">{m.date}</span>
                <button className="btn-icon btn-delete" onClick={() => onDelete(m.id)}>
                  <XIcon />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ===== SummaryCards =====
function SummaryCards({ tasks }) {
  const today = todayStr()
  const remaining = tasks.filter(t => !t.done).length
  const done = tasks.filter(t => t.done).length
  const todayTodo = tasks.filter(t => !t.done && t.date === today).length

  return (
    <div className="summary-cards">
      <SummaryCard label="残りタスク" value={remaining} color="var(--priority-high-line)" icon="📋" />
      <SummaryCard label="完了" value={done} color="#22c55e" icon="✅" />
      <SummaryCard label="今日やること" value={todayTodo} color="var(--priority-mid-line)" icon="📅" />
    </div>
  )
}

function SummaryCard({ label, value, color, icon }) {
  return (
    <div className="summary-card">
      <span className="summary-icon">{icon}</span>
      <div>
        <div className="summary-value" style={{ color }}>{value}</div>
        <div className="summary-label">{label}</div>
      </div>
    </div>
  )
}

// ===== Icons =====
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 7L5.5 10.5L12 3.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M9.5 2.5L11.5 4.5L4.5 11.5H2.5V9.5L9.5 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  )
}
function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}

// ===== App =====
export default function App() {
  const [tasks, setTasks] = useLocalStorage('myboard-tasks', [])
  const [memos, setMemos] = useLocalStorage('myboard-memos', [])
  const [tab, setTab] = useState('tasks')

  const addTask = useCallback(({ text, priority, category }) => {
    setTasks(prev => [{
      id: Date.now(),
      text,
      priority,
      category,
      done: false,
      date: todayStr(),
    }, ...prev])
  }, [setTasks])

  const toggleTask = useCallback(id => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))
  }, [setTasks])

  const editTask = useCallback((id, changes) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...changes } : t))
  }, [setTasks])

  const deleteTask = useCallback(id => {
    setTasks(prev => prev.filter(t => t.id !== id))
  }, [setTasks])

  const addMemo = useCallback(text => {
    setMemos(prev => [{
      id: Date.now(),
      text,
      date: new Date().toLocaleDateString('ja-JP'),
    }, ...prev])
  }, [setMemos])

  const deleteMemo = useCallback(id => {
    setMemos(prev => prev.filter(m => m.id !== id))
  }, [setMemos])

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <h1 className="app-title">
          <span className="app-title-icon">📌</span>
          マイボード
        </h1>
      </header>

      <main className="app-main">
        {/* Summary cards */}
        <SummaryCards tasks={tasks} />

        {/* Tabs */}
        <div className="tabs">
          <button
            className={`tab-btn${tab === 'tasks' ? ' active' : ''}`}
            onClick={() => setTab('tasks')}
          >
            タスク管理
          </button>
          <button
            className={`tab-btn${tab === 'ideas' ? ' active' : ''}`}
            onClick={() => setTab('ideas')}
          >
            アイデアメモ
          </button>
        </div>

        {/* Content */}
        {tab === 'tasks' ? (
          <TaskBoard
            tasks={tasks}
            onAdd={addTask}
            onToggle={toggleTask}
            onEdit={editTask}
            onDelete={deleteTask}
          />
        ) : (
          <IdeaBoard
            memos={memos}
            onAdd={addMemo}
            onDelete={deleteMemo}
          />
        )}
      </main>
    </div>
  )
}
