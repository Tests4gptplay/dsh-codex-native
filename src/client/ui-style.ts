import type { CSSProperties } from 'react'
/** Layout only. Every visual color/radius comes from the DSH theme; controls are official primitives. */
export const ui = {
  section: { display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, color: 'var(--dsw-alias-label-primary)' },
  card: { border: '0.5px solid var(--dsw-alias-border-l2)', borderRadius: 'var(--dsw-radius-lg)', padding: 16, minWidth: 0 },
  toolbar: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  secondary: { color: 'var(--dsw-alias-label-secondary)', fontSize: 12, lineHeight: 1.6 },
  note: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 12, lineHeight: 1.65 },
  count: { fontVariantNumeric: 'tabular-nums', fontWeight: 600, whiteSpace: 'nowrap' },
  heading: { margin: 0, fontSize: 14, lineHeight: 1.5, fontWeight: 600 },
  link: { color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 },
} satisfies Record<string, CSSProperties>
