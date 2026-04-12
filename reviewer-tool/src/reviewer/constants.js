export const STRICT_TURN_COUNT = 20

export const PRIORITY_ORDER = [
  'layout_margins',
  'spacing',
  'alignment',
  'typography',
  'tables_structure',
  'tables_formatting',
  'tables_data',
  'charts_structure',
  'charts_visual_quality',
  'headers_footers',
  'colors_branding',
  'lists',
  'images',
  'page_flow',
  'print_readiness',
  'document_structure',
  'content_accuracy',
  'math_calculations',
  'writing_tone',
]

export const PRIORITY_LABELS = {
  layout_margins: 'Layout & margins',
  spacing: 'Spacing',
  alignment: 'Alignment',
  typography: 'Typography & fonts',
  tables_structure: 'Tables (structure)',
  tables_formatting: 'Tables (formatting)',
  tables_data: 'Tables (data)',
  charts_structure: 'Charts (structure)',
  charts_visual_quality: 'Charts (visuals)',
  headers_footers: 'Headers, footers, page numbers',
  colors_branding: 'Colors & branding',
  lists: 'Lists',
  images: 'Images',
  page_flow: 'Page flow & breaks',
  print_readiness: 'Print readiness',
  document_structure: 'Document structure',
  content_accuracy: 'Content & accuracy',
  math_calculations: 'Math & calculations',
  writing_tone: 'Writing & tone',
}

export const DOC_TYPE_LABELS = {
  both: 'Both',
  docx: 'DOCX only',
  pdf: 'PDF only',
}

export const LIBRARY_SORT_OPTIONS = [
  { value: 'priority', label: 'Workflow priority' },
  { value: 'a_z', label: 'A to Z' },
  { value: 'category', label: 'Category' },
  { value: 'doc_type', label: 'Doc type' },
]

export const SELECTED_SORT_OPTIONS = [
  { value: 'priority', label: 'Workflow priority' },
  { value: 'a_z', label: 'A to Z' },
  { value: 'category', label: 'Category' },
  { value: 'doc_type', label: 'Doc type' },
  { value: 'turn', label: 'Turn number' },
]

export const STRICT_RULES = [
  'Exactly 20 turns',
  'Each filled turn has 1 to 4 items',
  'Empty turns are allowed when you have fewer than 20 prompts',
  'Use semicolons between items',
  'Write direct modification requests only',
  'No explanations or justifications',
  'No hex codes in turn text',
  'No periods at the end of turns',
  'Plain blunt coworker wording',
]

export const TURN_BUILD_ORDER = [
  { id: 'layout_margins', label: 'Layout & margins', match: (item) => item.category === 'layout_margins' },
  { id: 'spacing', label: 'Spacing', match: (item) => item.category === 'spacing' },
  { id: 'alignment', label: 'Alignment', match: (item) => item.category === 'alignment' },
  { id: 'typography', label: 'Typography & fonts', match: (item) => item.category === 'typography' },
  { id: 'tables_structure', label: 'Tables (structure)', match: (item) => item.category === 'tables_structure' },
  { id: 'tables_formatting', label: 'Tables (formatting)', match: (item) => item.category === 'tables_formatting' },
  { id: 'tables_data', label: 'Tables (data)', match: (item) => item.category === 'tables_data' },
  { id: 'charts_structure', label: 'Charts (structure)', match: (item) => item.category === 'charts_structure' },
  { id: 'charts_visual_quality', label: 'Charts (visuals)', match: (item) => item.category === 'charts_visual_quality' },
  { id: 'headers_footers', label: 'Headers, footers, page numbers', match: (item) => item.category === 'headers_footers' },
  { id: 'colors_branding', label: 'Colors & branding', match: (item) => item.category === 'colors_branding' },
  { id: 'lists', label: 'Lists', match: (item) => item.category === 'lists' },
  { id: 'images', label: 'Images', match: (item) => item.category === 'images' },
  { id: 'page_flow', label: 'Page flow & breaks', match: (item) => item.category === 'page_flow' },
  { id: 'print_readiness', label: 'Print readiness', match: (item) => item.category === 'print_readiness' },
  { id: 'document_structure', label: 'Document structure', match: (item) => item.category === 'document_structure' },
  { id: 'content_accuracy', label: 'Content & accuracy', match: (item) => item.category === 'content_accuracy' },
  { id: 'math_calculations', label: 'Math & calculations', match: (item) => item.category === 'math_calculations' },
  { id: 'writing_tone', label: 'Writing & tone', match: (item) => item.category === 'writing_tone' },
]

export const STRICT_BANNED_WORDS = [
  'ensure',
  'enhance',
  'leverage',
  'utilize',
  'streamline',
  'comprehensive',
  'robust',
  'facilitate',
  'optimal',
]

export const WORKFLOW_SUMMARY = [
  'Walk the deliverable front to back and flag tiny local fixes',
  'Order issues by workflow priority before splitting into turns',
  'Keep each prompt short, local, and ready to paste into the next turn',
]
