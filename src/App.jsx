import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import './App.css'

// ===== Utility =====
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

// ===== Login Screen =====
function LoginScreen() {
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-icon">📌</div>
        <h1 className="login-title">マイボード</h1>
        <p className="login-desc">タスク管理 & アイデアメモ</p>
        <button className="btn-google" onClick={handleLogin} disabled={loading}>
          <GoogleIcon />
          {loading ? 'ログイン中...' : 'Googleでログイン'}
        </button>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.962L3.964 6.294C4.672 4.167 6.656 3.58 9 3.58z"/>
    </svg>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// ===== TaskItem =====
function TaskItem({ task, onToggle, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(task.text)
  const [editPriority, setEditPriority] = useState(task.priority)
  const [editDate, setEditDate] = useState(task.date || todayStr())
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
    onEdit(task.id, { text: editText, priority: editPriority, category: cat, date: editDate })
    setEditing(false)
  }

  return (
    <div
      className={`task-item${task.done ? ' done' : ''}`}
      style={{ borderLeftColor: priorityStyle(task.priority, 'line') }}
    >
      <button
        className={`task-check${task.done ? ' checked' : ''}`}
        onClick={() => onToggle(task.id, task.done)}
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
              <input type="date" className="select-sm" value={editDate} onChange={e => setEditDate(e.target.value)} />
              <select className="select-sm" value={editPriority} onChange={e => setEditPriority(e.target.value)}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
              <select className="select-sm" value={editCategory} onChange={e => setEditCategory(e.target.value)}>
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
              {task.date && <span className="badge-date">{formatDate(task.date)}</span>}
              <span className="badge-priority" style={{ background: priorityStyle(task.priority, 'bg'), color: priorityStyle(task.priority, 'text') }}>
                {task.priority}
              </span>
              <span className="badge-category">{task.category}</span>
            </div>
          </div>
        )}
      </div>

      {!editing && (
        <div className="task-actions">
          <button className="btn-icon" onClick={() => setEditing(true)} title="編集"><PencilIcon /></button>
          <button className="btn-icon btn-delete" onClick={() => onDelete(task.id)} title="削除"><XIcon /></button>
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
  const [date, setDate] = useState(todayStr())
  const [filterDate, setFilterDate] = useState('全て')
  const [filterPriority, setFilterPriority] = useState('全て')
  const [filterStatus, setFilterStatus] = useState('全て')

  const handleAdd = () => {
    if (!text.trim()) return
    const cat = category === 'その他' && categoryCustom.trim() ? categoryCustom.trim() : category
    onAdd({ text: text.trim(), priority, category: cat, date })
    setText('')
    setCategoryCustom('')
    setDate(todayStr())
  }

  const filtered = tasks.filter(t => {
    if (filterDate === '今日' && t.date !== todayStr()) return false
    if (filterDate === '今週' && !isThisWeek(t.date)) return false
    if (filterDate === '今月' && !isThisMonth(t.date)) return false
    if (filterPriority !== '全て' && t.priority !== filterPriority) return false
    if (filterStatus === '済' && !t.done) return false
    if (filterStatus === '未' && t.done) return false
    return true
  })

  return (
    <div className="board">
      <div className="add-form">
        <input
          className="add-input"
          placeholder="タスクを入力..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <div className="add-form-row">
          <input type="date" className="select-sm" value={date} onChange={e => setDate(e.target.value)} />
          <select className="select-sm" value={priority} onChange={e => setPriority(e.target.value)}>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
          <select className="select-sm" value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          {category === 'その他' && (
            <input className="select-sm" placeholder="カテゴリ名" value={categoryCustom} onChange={e => setCategoryCustom(e.target.value)} style={{ width: 110 }} />
          )}
          <button className="btn-add" onClick={handleAdd}>追加</button>
        </div>
      </div>

      <div className="filter-bar">
        <FilterGroup label="日付" options={['全て', '今日', '今週', '今月']} value={filterDate} onChange={setFilterDate} />
        <FilterGroup label="優先度" options={['全て', '高', '中', '低']} value={filterPriority} onChange={setFilterPriority} />
        <FilterGroup label="状況" options={['全て', '未', '済']} value={filterStatus} onChange={setFilterStatus} />
      </div>

      <div className="task-list">
        {filtered.length === 0 ? (
          <div className="empty-state">タスクはありません</div>
        ) : (
          filtered.map(t => (
            <TaskItem key={t.id} task={t} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
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
        <button key={opt} className={`filter-btn${value === opt ? ' active' : ''}`} onClick={() => onChange(opt)}>
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
                <button className="btn-icon btn-delete" onClick={() => onDelete(m.id)}><XIcon /></button>
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
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7L5.5 10.5L12 3.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function PencilIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9.5 2.5L11.5 4.5L4.5 11.5H2.5V9.5L9.5 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
}
function XIcon() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
}

// ===== App =====
export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState([])
  const [memos, setMemos] = useState([])
  const [tab, setTab] = useState('tasks')

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Load data when logged in
  useEffect(() => {
    if (!session) return
    fetchTasks()
    fetchMemos()
  }, [session])

  const fetchTasks = async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
    if (data) setTasks(data)
  }

  const fetchMemos = async () => {
    const { data } = await supabase
      .from('memos')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
    if (data) setMemos(data)
  }

  const addTask = useCallback(async ({ text, priority, category, date }) => {
    const { data } = await supabase.from('tasks').insert({
      text, priority, category, done: false, date: date || todayStr(),
      user_id: session.user.id,
    }).select().single()
    if (data) setTasks(prev => [data, ...prev])
  }, [session])

  const toggleTask = useCallback(async (id, currentDone) => {
    const { data } = await supabase.from('tasks').update({ done: !currentDone }).eq('id', id).select().single()
    if (data) setTasks(prev => prev.map(t => t.id === id ? data : t))
  }, [])

  const editTask = useCallback(async (id, changes) => {
    const { data } = await supabase.from('tasks').update(changes).eq('id', id).select().single()
    if (data) setTasks(prev => prev.map(t => t.id === id ? data : t))
  }, [])

  const deleteTask = useCallback(async (id) => {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }, [])

  const addMemo = useCallback(async (text) => {
    const { data } = await supabase.from('memos').insert({
      text, date: new Date().toLocaleDateString('ja-JP'),
      user_id: session.user.id,
    }).select().single()
    if (data) setMemos(prev => [data, ...prev])
  }, [session])

  const deleteMemo = useCallback(async (id) => {
    await supabase.from('memos').delete().eq('id', id)
    setMemos(prev => prev.filter(m => m.id !== id))
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setTasks([])
    setMemos([])
  }

  if (loading) {
    return <div className="loading-screen"><div className="loading-spinner" /></div>
  }

  if (!session) {
    return <LoginScreen />
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">
          <span className="app-title-icon">📌</span>
          マイボード
        </h1>
        <div className="header-user">
          {session?.user?.user_metadata?.avatar_url && (
            <img src={session.user.user_metadata.avatar_url} className="user-avatar" alt="" />
          )}
          <span className="user-email">{session?.user?.email ?? ''}</span>
          <button className="btn-logout" onClick={handleLogout}>ログアウト</button>
        </div>
      </header>

      <main className="app-main">
        <SummaryCards tasks={tasks} />
        <div className="tabs">
          <button className={`tab-btn${tab === 'tasks' ? ' active' : ''}`} onClick={() => setTab('tasks')}>タスク管理</button>
          <button className={`tab-btn${tab === 'ideas' ? ' active' : ''}`} onClick={() => setTab('ideas')}>アイデアメモ</button>
        </div>
        {tab === 'tasks' ? (
          <TaskBoard tasks={tasks} onAdd={addTask} onToggle={toggleTask} onEdit={editTask} onDelete={deleteTask} />
        ) : (
          <IdeaBoard memos={memos} onAdd={addMemo} onDelete={deleteMemo} />
        )}
      </main>
    </div>
  )
}
