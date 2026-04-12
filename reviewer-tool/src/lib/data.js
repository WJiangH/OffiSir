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
