/*
  The one place a saved picture becomes something a page may paint with.

  `community.picture` holds a web address — the Firebase Storage download url that
  src/admin/settings.jsx writes — and an address is a string somebody once typed into a box. Handing
  it straight to `background-image: url("...")` would let whatever is stored there close the quote
  and add to the rule, and handing it to an image source would let it fetch from wherever it liked.
  So every page that shows a community's picture asks this first, and an answer that is not an
  http(s) address means there is no picture: the hero paints its plain band and the settings preview
  shows the empty box instead of a broken one.

  `new URL` is the check rather than a pattern, because it does two jobs at once. It refuses a
  relative path, a bare storage key, `javascript:` and `data:` for the same reason — none of them is
  an absolute http address — and it percent-encodes the quotes and spaces a rule-breaking address
  would need on its way out, so what comes back can be embedded as it stands.
*/
export function pictureUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  let parsed = null
  try {
    parsed = new URL(raw)
  } catch {
    return ''
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return ''
  return parsed.href
}

/*
  The inline style for a hero that has a picture, and nothing at all for one that does not, so the
  stylesheet's plain band is what renders. The gradient sits in the CSS rather than here: it is
  part of how the banner looks, and only the address is data.
*/
export function heroStyle(value) {
  const src = pictureUrl(value)
  return src ? { backgroundImage: `url("${src}")` } : undefined
}
