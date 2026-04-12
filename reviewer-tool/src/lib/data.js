import { supabase } from './supabase'

export async function fetchUserStars(userId) {
  const { data, error } = await supabase
    .from('stars')
    .select('prompt_id')
    .eq('user_id', userId)
  if (error) throw error
  return new Set((data || []).map((r) => r.prompt_id))
}

export async function fetchStarCounts() {
  const { data, error } = await supabase.from('stars').select('prompt_id')
  if (error) throw error
  const counts = {}
  ;(data || []).forEach((r) => {
    counts[r.prompt_id] = (counts[r.prompt_id] || 0) + 1
  })
  return counts
}

export async function addStar(userId, promptId) {
  const { error } = await supabase.from('stars').insert({ user_id: userId, prompt_id: promptId })
  if (error) throw error
}

export async function removeStar(userId, promptId) {
  const { error } = await supabase
    .from('stars')
    .delete()
    .eq('user_id', userId)
    .eq('prompt_id', promptId)
  if (error) throw error
}

export async function fetchCustomPrompts() {
  const { data, error } = await supabase
    .from('custom_prompts')
    .select('id, category, subcategory, prompt_text, user_id, created_at')
  if (error) throw error
  return data || []
}

export async function insertCustomPrompt({ userId, category, subcategory, promptText }) {
  const { data, error } = await supabase
    .from('custom_prompts')
    .insert({ user_id: userId, category, subcategory, prompt_text: promptText })
    .select('id, category, subcategory, prompt_text, user_id, created_at')
    .single()
  if (error) throw error
  return data
}

export async function fetchUserTasks(userId) {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, task_name, selected_prompts, turns, copy_progress, config, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function insertTask({ userId, taskName, selectedPrompts, turns, copyProgress, config }) {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: userId,
      task_name: taskName,
      selected_prompts: selectedPrompts,
      turns,
      copy_progress: copyProgress,
      config,
    })
    .select('id, task_name, selected_prompts, turns, copy_progress, config, updated_at')
    .single()
  if (error) throw error
  return data
}

export async function updateTask(taskId, userId, { selectedPrompts, turns, copyProgress, config, taskName }) {
  const payload = {
    selected_prompts: selectedPrompts,
    turns,
    copy_progress: copyProgress,
    config,
  }
  if (taskName !== undefined) payload.task_name = taskName
  const { data, error } = await supabase
    .from('tasks')
    .update(payload)
    .eq('id', taskId)
    .eq('user_id', userId)
    .select('id, task_name, selected_prompts, turns, copy_progress, config, updated_at')
    .single()
  if (error) throw error
  return data
}

export async function deleteTask(taskId, userId) {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function insertRetryCommand({
  userId,
  taskId,
  originalTurn,
  retryTurn,
  originalPrompt,
  revisedPrompt,
}) {
  const { error } = await supabase
    .from('retry_commands')
    .insert({
      user_id: userId,
      task_id: taskId,
      original_turn: originalTurn,
      retry_turn: retryTurn,
      original_prompt: originalPrompt,
      revised_prompt: revisedPrompt,
    })
  if (error) throw error
}

export async function fetchAllUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, is_admin, created_at')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function fetchAdminStats() {
  const [users, tasks, customPrompts, stars] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('tasks').select('id', { count: 'exact', head: true }),
    supabase.from('custom_prompts').select('id', { count: 'exact', head: true }),
    supabase.from('stars').select('user_id', { count: 'exact', head: true }),
  ])
  if (users.error) throw users.error
  if (tasks.error) throw tasks.error
  if (customPrompts.error) throw customPrompts.error
  if (stars.error) throw stars.error
  return {
    users: users.count || 0,
    tasks: tasks.count || 0,
    customPrompts: customPrompts.count || 0,
    stars: stars.count || 0,
  }
}

export async function fetchPerUserCounts() {
  const [tasks, stars, customs] = await Promise.all([
    supabase.from('tasks').select('user_id'),
    supabase.from('stars').select('user_id'),
    supabase.from('custom_prompts').select('user_id'),
  ])
  if (tasks.error) throw tasks.error
  if (stars.error) throw stars.error
  if (customs.error) throw customs.error
  const counts = {}
  const bump = (uid, key) => {
    if (!counts[uid]) counts[uid] = { tasks: 0, stars: 0, customPrompts: 0 }
    counts[uid][key] += 1
  }
  ;(tasks.data || []).forEach((r) => bump(r.user_id, 'tasks'))
  ;(stars.data || []).forEach((r) => bump(r.user_id, 'stars'))
  ;(customs.data || []).forEach((r) => bump(r.user_id, 'customPrompts'))
  return counts
}

export async function deleteUser(userId) {
  const { data, error } = await supabase
    .from('users')
    .delete()
    .eq('id', userId)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('Delete affected no rows — check RLS policies for users.')
  }
  return data[0]
}

export async function fetchRetryCommands(userId, taskId) {
  const { data, error } = await supabase
    .from('retry_commands')
    .select('original_turn, retry_turn, original_prompt, revised_prompt, created_at')
    .eq('user_id', userId)
    .eq('task_id', taskId)
    .order('retry_turn', { ascending: true })
  if (error) throw error
  return data || []
}
