import { describe, expect, it } from 'vitest'

import { heroStyle, pictureUrl } from '../src/page_functions/picture.js'

/*
  The one gate between `community.picture` and a page's own styling.

  What the column holds is an address somebody typed or an upload wrote, and the hero hands it straight
  to `background-image: url("...")`. Two things can go wrong there and both are answered here rather
  than in CSS: an address that is not an address at all — a bare storage key, a `data:` or a
  `javascript:` string — and an address carrying the one character that would let it stop being a url
  and start being a rule, which is the double quote that closes `url("…")`. `new URL` is what removes
  both worries, because it percent-encodes that quote on the way out and it refuses anything that is
  not absolute. These tests hold that behaviour down, since a rewrite to a regular expression would
  quietly keep the first half and lose the second.
*/

describe('pictureUrl', () => {
  it('takes a plain https address as it stands', () => {
    const saved = 'https://firebasestorage.googleapis.com/v0/b/kopano.a/o/community-pictures%2F4%2F1.jpg?alt=media&token=9'
    expect(pictureUrl(saved)).toBe(saved)
  })

  it("takes an http one too, because a self-hosted gallery is somebody's real picture", () => {
    expect(pictureUrl('http://images.example.co/hall.jpg')).toBe('http://images.example.co/hall.jpg')
  })

  it('trims what was stored around it', () => {
    expect(pictureUrl('  https://example.co/hall.jpg  ')).toBe('https://example.co/hall.jpg')
  })

  it('says nothing at all for nothing saved', () => {
    expect(pictureUrl('')).toBe('')
    expect(pictureUrl(null)).toBe('')
    expect(pictureUrl(undefined)).toBe('')
    expect(pictureUrl(42)).toBe('')
  })

  it('refuses a bare storage path, which is where an upload lives and not what a page paints', () => {
    expect(pictureUrl('community-pictures/4/1712345678901.jpg')).toBe('')
  })

  it('refuses a scheme that is not a picture, however valid a url it makes', () => {
    expect(pictureUrl('javascript:alert(1)')).toBe('')
    expect(pictureUrl('data:image/png;base64,AAAA')).toBe('')
    expect(pictureUrl('gs://kopano/community-pictures/4/1.jpg')).toBe('')
    expect(pictureUrl('//images.example.co/hall.jpg')).toBe('')
  })

  it('closes the quote a background rule would have been broken with, instead of passing it on', () => {
    const sneaky = 'https://example.co/a");background:#000;(" b.jpg'
    const kept = pictureUrl(sneaky)
    expect(kept).not.toContain('"')
    expect(kept.startsWith('https://example.co/')).toBe(true)
  })

  it('keeps a token query intact, because a firebase address is nothing without it', () => {
    expect(pictureUrl('https://x.googleapis.com/v0/b/k/o/p.jpg?alt=media&token=abc-123')).toContain(
      'token=abc-123',
    )
  })
})

describe('heroStyle', () => {
  it('gives a hero nothing to paint when there is no picture, so the plain band shows', () => {
    expect(heroStyle(null)).toBeUndefined()
    expect(heroStyle('community-pictures/4/1.jpg')).toBeUndefined()
  })

  it('gives it the address as a background when there is one', () => {
    expect(heroStyle('https://example.co/hall.jpg')).toEqual({
      backgroundImage: 'url("https://example.co/hall.jpg")',
    })
  })
})
