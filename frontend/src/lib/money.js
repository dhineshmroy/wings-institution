// Change "Rs." here if you ever need another currency label.
export const fmtMoney = (n) =>
  'Rs. ' + Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

export const monthName = (isoDate) => {
  const [y, m] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}
