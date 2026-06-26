/**
 * Escalation Engine — Chain of Command
 *
 * If a complaint stays 'pending' (ward ignores it), it auto-escalates:
 *   0–3 days   → Level 1: वडा (Ward)
 *   3–7 days   → Level 2: नगरपालिका (Municipality)
 *   7–14 days  → Level 3: प्रदेश (Province)
 *   14+ days   → Level 4: संघीय मन्त्रालय (Federal Ministry)
 */

export interface EscalationInfo {
  level: number
  label: string
  labelEn: string
  color: string
  bgColor: string
  daysOld: number
  daysUntilNextLevel: number | null  // null if already at max
  warning: string | null             // shown on ward dashboard
}

const LEVELS = [
  { level: 1, label: 'वडा तह',            labelEn: 'Ward Level',          color: 'text-zinc-400',   bgColor: 'bg-zinc-500/10',   border: 'border-zinc-500/20' },
  { level: 2, label: 'नगरपालिका तह',      labelEn: 'Municipality Level',  color: 'text-blue-400',   bgColor: 'bg-blue-500/10',   border: 'border-blue-500/20' },
  { level: 3, label: 'प्रदेश तह',          labelEn: 'Province Level',      color: 'text-orange-400', bgColor: 'bg-orange-500/10', border: 'border-orange-500/20' },
  { level: 4, label: 'संघीय मन्त्रालय तह', labelEn: 'Federal Ministry',    color: 'text-red-400',    bgColor: 'bg-red-500/10',    border: 'border-red-500/20' },
]

const THRESHOLDS = [0, 3, 7, 14] // days to reach each level

export function computeEscalation(createdAt: string, status: string, storedLevel?: number): EscalationInfo {
  const daysOld = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)

  // Resolved complaints don't escalate
  if (status === 'resolved') {
    const info = LEVELS[0]
    return { ...info, daysOld, daysUntilNextLevel: null, warning: null }
  }

  // Compute level from age
  let level = 1
  if (daysOld >= 14) level = 4
  else if (daysOld >= 7) level = 3
  else if (daysOld >= 3) level = 2

  // Use stored level if higher (manual escalation)
  if (storedLevel && storedLevel > level) level = storedLevel

  const info = LEVELS[level - 1]

  // Days until next escalation
  let daysUntilNextLevel: number | null = null
  let warning: string | null = null
  if (level < 4) {
    const nextThreshold = THRESHOLDS[level]
    daysUntilNextLevel = Math.max(0, Math.ceil(nextThreshold - daysOld))
    if (daysUntilNextLevel <= 2) {
      const nextLevelLabel = LEVELS[level].label
      warning = daysUntilNextLevel === 0
        ? `⚠️ यो उजुरी आज ${nextLevelLabel}मा जान्छ!`
        : `⚠️ ${daysUntilNextLevel} दिनमा ${nextLevelLabel}मा जान्छ — अहिले समाधान गर्नुहोस्`
    }
  }

  return { ...info, daysOld, daysUntilNextLevel, warning }
}

/** Get border color string for escalation level */
export function escalationBorder(level: number): string {
  return ['border-zinc-500/20', 'border-blue-500/30', 'border-orange-500/30', 'border-red-500/40'][level - 1] || 'border-zinc-500/20'
}

/** Category → ministry slug mapping (mirrors routing.json) */
export const CATEGORY_TO_MINISTRY: Record<string, string> = {
  Education:      'education',
  Infrastructure: 'infrastructure',
  Health:         'health',
  Water:          'energy-water',
  Electricity:    'energy-water',
  Corruption:     'ciaa',
  Safety:         'home-affairs',
  Environment:    'environment',
  Other:          'home-affairs',
}
