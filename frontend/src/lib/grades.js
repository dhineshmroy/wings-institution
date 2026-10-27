// A typical A / B / C / S / W scale. Change the numbers here to match your own grading.
export const GRADES = [
  { min: 75, grade: 'A' },
  { min: 65, grade: 'B' },
  { min: 55, grade: 'C' },
  { min: 35, grade: 'S' },
  { min: 0, grade: 'W' },
]
export const GRADE_ORDER = GRADES.map((g) => g.grade)
export const gradeOf = (pct) => (pct === null || pct === undefined ? '' : GRADES.find((g) => pct >= g.min)?.grade || 'W')
export const EXAM_TYPES = { unit: 'Unit exam', term: 'Term exam', other: 'Other' }
export const num = (n) => (n === null || n === undefined ? '' : String(Math.round(Number(n) * 100) / 100))
