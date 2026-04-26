import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
const CATEGORIES = ['本業', '副業', '趣味', '日常生活', 'その他']

// ===== Google Calendar API =====
const GCAL_EVENTS = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const COLOR_ID = { 赤: '11', 青: '9', 黄: '5', 黄色: '5', 緑: '10', 紫: '3' }
const SHEET_ID = '1lzJqZwUxScN6vb6kvcg5UbwXPisBUCLV6qpqXBycNms'

function parseJaDate(str) {
  if (!str) return null
  const m = String(str).match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
  if (!m) return null
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
}

async function gcalCreateSchedule(token, { date, startTime, endTime, content, color }) {
  try {
    const res = await fetch(GCAL_EVENTS, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: content,
        start: { dateTime: `${date}T${startTime}:00+09:00`, timeZone: 'Asia/Tokyo' },
        end:   { dateTime: `${date}T${endTime}:00+09:00`,   timeZone: 'Asia/Tokyo' },
        colorId: COLOR_ID[color] ?? '9',
        reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 1440 }] },
      }),
    })
    return res.ok
  } catch { return false }
}

function extractSheetId(input) {
  if (!input) return null
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (m) return m[1]
  if (/^[a-zA-Z0-9_-]{20,}$/.test(input.trim())) return input.trim()
  return null
}

async function fetchSheetRows(token, sheetId) {
  const id = sheetId || SHEET_ID
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/latest!A2:E100`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`${res.status}: ${body?.error?.message ?? res.statusText}`)
  }
  const { values = [] } = await res.json()
  return values.filter(r => r[0] && parseJaDate(r[0]))
}

function gcalEndDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

async function gcalCreate(token, text, date) {
  try {
    const res = await fetch(GCAL_EVENTS, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: text, start: { date }, end: { date: gcalEndDate(date) } }),
    })
    if (!res.ok) return null
    return (await res.json()).id
  } catch { return null }
}

async function gcalUpdate(token, eventId, text, date) {
  try {
    await fetch(`${GCAL_EVENTS}/${eventId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: text, start: { date }, end: { date: gcalEndDate(date) } }),
    })
  } catch { /* silent */ }
}

async function gcalDelete(token, eventId) {
  try {
    await fetch(`${GCAL_EVENTS}/${eventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch { /* silent */ }
}

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
      options: {
        scopes: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/spreadsheets.readonly',
        redirectTo: window.location.origin,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
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
  const [filterCategory, setFilterCategory] = useState('全て')

  const handleAdd = () => {
    if (!text.trim()) return
    const cat = category === 'その他' && categoryCustom.trim() ? categoryCustom.trim() : category
    onAdd({ text: text.trim(), priority, category: cat, date })
    setText('')
    setCategoryCustom('')
    setDate(todayStr())
  }

  const categoryOptions = ['全て', ...CATEGORIES]

  const filtered = tasks.filter(t => {
    if (filterDate === '今日' && t.date !== todayStr()) return false
    if (filterDate === '今週' && !isThisWeek(t.date)) return false
    if (filterDate === '今月' && !isThisMonth(t.date)) return false
    if (filterPriority !== '全て' && t.priority !== filterPriority) return false
    if (filterStatus === '済' && !t.done) return false
    if (filterStatus === '未' && t.done) return false
    if (filterCategory !== '全て' && t.category !== filterCategory) return false
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
        <FilterGroup label="カテゴリ" options={categoryOptions} value={filterCategory} onChange={setFilterCategory} />
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
function IdeaBoard({ memos, onAdd, onDelete, onReorder, onUpdate }) {
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [localGroups, setLocalGroups] = useState([])
  const [addingGroup, setAddingGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [adding, setAdding] = useState(false)
  const [newText, setNewText] = useState('')
  const [newColor, setNewColor] = useState('青')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 400, tolerance: 8 } })
  )

  const dbGroupNames = useMemo(() => [...new Set(memos.map(m => m.group_name))], [memos])
  const allGroupNames = useMemo(() => [...new Set([...dbGroupNames, ...localGroups])], [dbGroupNames, localGroups])

  const groupedMemos = useMemo(() => {
    const map = {}
    allGroupNames.forEach(g => { map[g] = [] })
    memos.forEach(m => { if (map[m.group_name]) map[m.group_name].push(m) })
    Object.values(map).forEach(arr => arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)))
    return map
  }, [memos, allGroupNames])

  useEffect(() => {
    if (!selectedGroup && allGroupNames.length > 0) setSelectedGroup(allGroupNames[0])
  }, [allGroupNames, selectedGroup])

  const selectedIdeas = selectedGroup ? (groupedMemos[selectedGroup] ?? []) : []

  const handleAddGroup = () => {
    if (!newGroupName.trim()) return
    setLocalGroups(prev => [...prev, newGroupName.trim()])
    setSelectedGroup(newGroupName.trim())
    setNewGroupName('')
    setAddingGroup(false)
  }

  const handleAddIdea = async () => {
    if (!newText.trim() || !selectedGroup) return
    const items = groupedMemos[selectedGroup] ?? []
    const maxOrder = items.length > 0 ? Math.max(...items.map(m => m.sort_order ?? 0)) : -1
    await onAdd({ text: newText.trim(), group_name: selectedGroup, color: newColor, sort_order: maxOrder + 1 })
    setLocalGroups(prev => prev.filter(g => g !== selectedGroup))
    setNewText('')
    setNewColor('青')
    setAdding(false)
  }

  const handleDeleteGroup = (groupName) => {
    ;(groupedMemos[groupName] ?? []).forEach(m => onDelete(m.id))
    setLocalGroups(prev => prev.filter(g => g !== groupName))
    const remaining = allGroupNames.filter(g => g !== groupName)
    setSelectedGroup(remaining[0] ?? null)
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id || !selectedGroup) return
    const items = groupedMemos[selectedGroup]
    const oldIndex = items.findIndex(m => m.id === active.id)
    const newIndex = items.findIndex(m => m.id === over.id)
    onReorder(arrayMove(items, oldIndex, newIndex).map((m, i) => ({ id: m.id, sort_order: i })))
  }

  return (
    <div className="idea-layout">
      <div className="idea-sidebar">
        {allGroupNames.map(g => (
          <button key={g} className={`idea-sidebar-item${selectedGroup === g ? ' active' : ''}`} onClick={() => setSelectedGroup(g)}>
            <span className="idea-sidebar-name">{g}</span>
            <span className="idea-sidebar-count">{(groupedMemos[g] ?? []).length}</span>
          </button>
        ))}
        {addingGroup ? (
          <div className="idea-sidebar-new-group">
            <input className="add-input" placeholder="グループ名..." value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddGroup(); if (e.key === 'Escape') setAddingGroup(false) }}
              autoFocus style={{ fontSize: 13 }} />
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              <button className="btn-add" style={{ flex: 1 }} onClick={handleAddGroup}>作成</button>
              <button className="btn-cancel" onClick={() => setAddingGroup(false)}>×</button>
            </div>
          </div>
        ) : (
          <button className="idea-sidebar-add-btn" onClick={() => setAddingGroup(true)}>＋ グループを追加</button>
        )}
      </div>

      <div className="idea-main">
        {selectedGroup ? (
          <>
            <div className="idea-main-header">
              <h2 className="idea-main-title">{selectedGroup}</h2>
              <button className="btn-icon btn-delete" onClick={() => handleDeleteGroup(selectedGroup)} title="グループを削除"><XIcon /></button>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={selectedIdeas.map(m => m.id)} strategy={rectSortingStrategy}>
                <div className="idea-cards-grid">
                  {selectedIdeas.map(idea => (
                    <SortableIdeaCard key={idea.id} idea={idea} onDelete={onDelete} onUpdate={onUpdate} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            {adding ? (
              <div className="idea-add-form-inline">
                <input className="add-input" placeholder="アイデアを入力..." value={newText}
                  onChange={e => setNewText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddIdea(); if (e.key === 'Escape') setAdding(false) }}
                  autoFocus />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  {SCHED_COLORS.map(c => (
                    <button key={c} onClick={() => setNewColor(c)} style={{
                      width: 22, height: 22, borderRadius: '50%', background: COLOR_STYLE[c],
                      border: newColor === c ? '3px solid #1e293b' : '3px solid transparent', flexShrink: 0,
                    }} title={c} />
                  ))}
                  <button className="btn-save" style={{ marginLeft: 'auto' }} onClick={handleAddIdea}>追加</button>
                  <button className="btn-cancel" onClick={() => setAdding(false)}>×</button>
                </div>
              </div>
            ) : (
              <button className="idea-add-idea-btn" onClick={() => setAdding(true)}>＋ アイデアを追加</button>
            )}
          </>
        ) : (
          <div className="empty-state">グループを追加してください</div>
        )}
      </div>
    </div>
  )
}

function SortableIdeaCard({ idea, onDelete, onUpdate }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: idea.id })
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(idea.text)
  const [editColor, setEditColor] = useState(idea.color || '青')
  const lastTap = useRef(0)

  const handleDoubleTap = () => {
    const now = Date.now()
    if (now - lastTap.current < 300) {
      setEditText(idea.text)
      setEditColor(idea.color || '青')
      setEditing(true)
    }
    lastTap.current = now
  }

  const handleSave = () => {
    if (!editText.trim()) return
    onUpdate(idea.id, { text: editText.trim(), color: editColor })
    setEditing(false)
  }

  return (
    <div ref={setNodeRef}
      {...listeners} {...attributes}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, touchAction: 'none' }}
      className="idea-card">
      {editing ? (
        <>
          <input className="add-input" value={editText} onChange={e => setEditText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
            autoFocus style={{ marginBottom: 8 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {SCHED_COLORS.map(c => (
              <button key={c} onClick={() => setEditColor(c)} style={{
                width: 20, height: 20, borderRadius: '50%', background: COLOR_STYLE[c],
                border: editColor === c ? '3px solid #1e293b' : '3px solid transparent', flexShrink: 0,
              }} />
            ))}
            <button className="btn-save" style={{ marginLeft: 'auto' }} onClick={handleSave}>保存</button>
            <button className="btn-cancel" onClick={() => setEditing(false)}>×</button>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, width: '100%' }}>
          <div className="idea-card-drag"><DragIcon /></div>
          <div className="idea-card-dot" style={{ background: COLOR_STYLE[idea.color] ?? '#3b82f6', marginTop: 3 }} />
          <span className="idea-card-text" style={{ flex: 1 }} onClick={handleDoubleTap}>{idea.text}</span>
          <button className="btn-icon" onClick={() => { setEditText(idea.text); setEditColor(idea.color || '青'); setEditing(true) }} title="編集"><PencilIcon /></button>
          <button className="btn-icon btn-delete" onClick={() => onDelete(idea.id)}><XIcon /></button>
        </div>
      )}
    </div>
  )
}

// ===== ScheduleBoard =====
const SCHED_COLORS = ['赤', '青', '黄', '緑', '紫']
const COLOR_STYLE = { 赤: '#ef4444', 青: '#3b82f6', 黄: '#eab308', 緑: '#22c55e', 紫: '#a855f7' }

function ScheduleBoard({ providerToken }) {
  const [date, setDate] = useState(todayStr())
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [content, setContent] = useState('')
  const [color, setColor] = useState('青')
  const [status, setStatus] = useState('')
  const [sheetUrl, setSheetUrl] = useState('')
  const [sheetRows, setSheetRows] = useState([])
  const [selected, setSelected] = useState([])
  const [sheetStatus, setSheetStatus] = useState('')
  const [loadingSheet, setLoadingSheet] = useState(false)
  const [registering, setRegistering] = useState(false)

  const handleAdd = async () => {
    if (!content.trim() || !providerToken) return
    const ok = await gcalCreateSchedule(providerToken, { date, startTime, endTime, content: content.trim(), color })
    if (ok) {
      setStatus('✅ カレンダーに登録しました')
      setContent('')
    } else {
      setStatus('❌ 登録に失敗しました')
    }
    setTimeout(() => setStatus(''), 3000)
  }

  const handleLoadSheet = async () => {
    if (!providerToken) return
    const sheetId = extractSheetId(sheetUrl)
    if (!sheetId) {
      setSheetStatus('❌ URLまたはシートIDが正しくありません')
      return
    }
    setLoadingSheet(true)
    setSheetStatus('')
    try {
      const rows = await fetchSheetRows(providerToken, sheetId)
      setSheetRows(rows)
      setSelected([])
      setSheetStatus(rows.length === 0 ? '⚠️ データがありません（シート名「latest」・A列が「YYYY年M月D日」形式か確認）' : `✅ ${rows.length}件取得しました`)
    } catch (e) {
      setSheetRows([])
      setSheetStatus(`❌ エラー: ${e.message}`)
    }
    setLoadingSheet(false)
  }

  const allSelected = sheetRows.length > 0 && selected.length === sheetRows.length

  const toggleSelectAll = () => {
    setSelected(allSelected ? [] : sheetRows.map((_, i) => i))
  }

  const toggleSelect = (i) => {
    setSelected(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])
  }

  const handleBulkRegister = async () => {
    if (!providerToken || selected.length === 0) return
    setRegistering(true)
    setSheetStatus('')
    let success = 0
    for (const i of selected) {
      const [jaDate, startT, endT, cont, col] = sheetRows[i]
      const date = parseJaDate(jaDate)
      if (!date) continue
      const ok = await gcalCreateSchedule(providerToken, {
        date, startTime: startT, endTime: endT, content: cont, color: col || '青'
      })
      if (ok) success++
    }
    setSheetStatus(`✅ ${success}件をGoogleカレンダーに登録しました！`)
    setSelected([])
    setRegistering(false)
  }

  return (
    <div className="board">
      <div className="add-form">
        <div className="add-form-row">
          <input type="date" className="select-sm" value={date} onChange={e => setDate(e.target.value)} />
          <input type="time" className="select-sm" value={startTime} onChange={e => setStartTime(e.target.value)} />
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>〜</span>
          <input type="time" className="select-sm" value={endTime} onChange={e => setEndTime(e.target.value)} />
        </div>
        <input className="add-input" placeholder="内容を入力..." value={content} onChange={e => setContent(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
        <div className="add-form-row">
          <div style={{ display: 'flex', gap: 6 }}>
            {SCHED_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} style={{
                width: 28, height: 28, borderRadius: '50%', background: COLOR_STYLE[c],
                border: color === c ? '3px solid var(--color-text-primary)' : '3px solid transparent',
                flexShrink: 0,
              }} title={c} />
            ))}
          </div>
          <button className="btn-add" onClick={handleAdd} disabled={!providerToken}>登録</button>
        </div>
        {status && <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{status}</div>}
      </div>

      <div className="add-form">
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>スプレッドシートから一括登録</div>
        <div className="add-form-row">
          <input
            className="add-input"
            placeholder="スプレッドシートのURLまたはシートID"
            value={sheetUrl}
            onChange={e => setSheetUrl(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="btn-add" onClick={handleLoadSheet} disabled={loadingSheet || !providerToken}>
            {loadingSheet ? '読込中...' : '読み込む'}
          </button>
        </div>
        {sheetStatus && <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{sheetStatus}</div>}
        {sheetRows.length > 0 && (
          <>
            <div
              className="task-item"
              style={{ borderLeftColor: '#9ca3af', cursor: 'pointer', background: 'var(--color-bg-secondary)' }}
              onClick={toggleSelectAll}
            >
              <div className={`task-check${allSelected ? ' checked' : ''}`} style={{ flexShrink: 0 }}>
                {allSelected && <CheckIcon />}
              </div>
              <div className="task-body">
                <span className="task-text" style={{ fontWeight: 600 }}>すべて選択</span>
              </div>
            </div>
            <div className="task-list" style={{ maxHeight: 300, overflowY: 'auto' }}>
              {sheetRows.map((row, i) => (
                <div key={i} className="task-item" style={{ borderLeftColor: COLOR_STYLE[row[4]] ?? '#9ca3af', cursor: 'pointer' }}
                  onClick={() => toggleSelect(i)}>
                  <div className={`task-check${selected.includes(i) ? ' checked' : ''}`} style={{ flexShrink: 0 }}>
                    {selected.includes(i) && <CheckIcon />}
                  </div>
                  <div className="task-body">
                    <div className="task-main">
                      <span className="task-text">{row[3]}</span>
                      <div className="task-meta">
                        <span className="badge-date">{row[0]}</span>
                        <span className="badge-category">{row[1]}〜{row[2]}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="add-form-row" style={{ justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{selected.length}件選択中</span>
              <button className="btn-add" onClick={handleBulkRegister} disabled={selected.length === 0 || registering}>
                {registering ? '登録中...' : 'まとめてカレンダーに登録'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ===== SummaryCards =====
function SummaryCards({ tasks }) {
  const today = todayStr()
  const todayTodo = tasks.filter(t => !t.done && t.date === today).length
  const remaining = tasks.filter(t => !t.done).length
  const highPriority = tasks.filter(t => !t.done && t.priority === '高').length

  return (
    <div className="summary-cards">
      <SummaryCard label="今日まで" value={todayTodo} color="var(--priority-mid-line)" icon="📅" />
      <SummaryCard label="残り" value={remaining} color="var(--priority-high-line)" icon="📋" />
      <SummaryCard label="優先度高" value={highPriority} color="#E24B4A" icon="🔥" />
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
function DragIcon() {
  return (
    <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
      <circle cx="4" cy="3" r="1.5"/><circle cx="8" cy="3" r="1.5"/>
      <circle cx="4" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/>
      <circle cx="4" cy="13" r="1.5"/><circle cx="8" cy="13" r="1.5"/>
    </svg>
  )
}

// ===== App =====
export default function App() {
  const [session, setSession] = useState(null)
  const [providerToken, setProviderToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState([])
  const [memos, setMemos] = useState([])
  const [tab, setTab] = useState('tasks')


  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setProviderToken(session?.provider_token ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setProviderToken(session?.provider_token ?? null)
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
      .order('group_name', { ascending: true })
      .order('sort_order', { ascending: true })
    if (data) setMemos(data)
  }

  const addTask = useCallback(async ({ text, priority, category, date }) => {
    const taskDate = date || todayStr()
    const { data } = await supabase.from('tasks').insert({
      text, priority, category, done: false, date: taskDate,
      user_id: session.user.id,
    }).select().single()
    if (data) {
      setTasks(prev => [data, ...prev])
      if (providerToken) {
        const eventId = await gcalCreate(providerToken, text, taskDate)
        if (eventId) {
          await supabase.from('tasks').update({ gcal_event_id: eventId }).eq('id', data.id)
          setTasks(prev => prev.map(t => t.id === data.id ? { ...t, gcal_event_id: eventId } : t))
        }
      }
    }
  }, [session, providerToken])

  const toggleTask = useCallback(async (id, currentDone) => {
    const { data } = await supabase.from('tasks').update({ done: !currentDone }).eq('id', id).select().single()
    if (data) setTasks(prev => prev.map(t => t.id === id ? data : t))
  }, [])

  const editTask = useCallback(async (id, changes) => {
    const { data } = await supabase.from('tasks').update(changes).eq('id', id).select().single()
    if (data) {
      setTasks(prev => prev.map(t => t.id === id ? data : t))
      if (providerToken && data.gcal_event_id) {
        await gcalUpdate(providerToken, data.gcal_event_id, data.text, data.date || todayStr())
      }
    }
  }, [providerToken])

  const deleteTask = useCallback(async (id) => {
    const task = tasks.find(t => t.id === id)
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
    if (providerToken && task?.gcal_event_id) {
      await gcalDelete(providerToken, task.gcal_event_id)
    }
  }, [tasks, providerToken])

  const addMemo = useCallback(async ({ text, group_name, color, sort_order }) => {
    const { data } = await supabase.from('memos').insert({
      text, date: new Date().toLocaleDateString('ja-JP'),
      group_name: group_name || 'その他',
      color: color || '青',
      sort_order: sort_order ?? 0,
      user_id: session.user.id,
    }).select().single()
    if (data) setMemos(prev => [...prev, data])
  }, [session])

  const updateMemo = useCallback(async (id, changes) => {
    const { data } = await supabase.from('memos').update(changes).eq('id', id).select().single()
    if (data) setMemos(prev => prev.map(m => m.id === id ? data : m))
  }, [])

  const reorderMemos = useCallback(async (updates) => {
    const map = Object.fromEntries(updates.map(u => [u.id, u.sort_order]))
    setMemos(prev => prev.map(m => map[m.id] !== undefined ? { ...m, sort_order: map[m.id] } : m))
    await Promise.all(updates.map(({ id, sort_order }) =>
      supabase.from('memos').update({ sort_order }).eq('id', id)
    ))
  }, [])

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

      <main className={`app-main${tab === 'ideas' ? ' app-main--wide' : ''}`}>
        <div className="tabs">
          <button className={`tab-btn${tab === 'schedule' ? ' active' : ''}`} onClick={() => setTab('schedule')}>スケジュール</button>
          <button className={`tab-btn${tab === 'tasks' ? ' active' : ''}`} onClick={() => setTab('tasks')}>タスク管理</button>
          <button className={`tab-btn${tab === 'ideas' ? ' active' : ''}`} onClick={() => setTab('ideas')}>アイデアメモ</button>
        </div>
        {tab === 'tasks' && <><SummaryCards tasks={tasks} /><TaskBoard tasks={tasks} onAdd={addTask} onToggle={toggleTask} onEdit={editTask} onDelete={deleteTask} /></>}
        {tab === 'ideas' && <IdeaBoard memos={memos} onAdd={addMemo} onDelete={deleteMemo} onReorder={reorderMemos} onUpdate={updateMemo} />}
        {tab === 'schedule' && <ScheduleBoard providerToken={providerToken} />}
      </main>
    </div>
  )
}
