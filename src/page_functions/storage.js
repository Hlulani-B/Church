import { deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage'

import { app } from '../firebase.js'
import { pictureUrl } from './picture.js'

/*
  A community's picture, put in Firebase Storage and answered with the address that belongs in
  `community.picture`.

  Every other file in this app goes to the Supabase bucket through the server, because that bucket's
  row-level security refuses a browser and the server's key does not (src/page_functions/upload.js).
  This one goes to Firebase Storage instead — the bucket this app's own sign-in lives in.
  src/firebase.js already names it, so no second config is built here and the write runs on the
  caller's id token: whoever can sign in and administer a fellowship is the person allowed to change
  what that fellowship looks like. If the bucket's rules refuse a signed-in write, that comes back as
  the sentence in `refused` rather than as a code nobody can read.

  The bytes are redrawn before they leave the page. A hero is painted across a screen and not across
  a print, so a phone's twelve-megapixel original is heavier than anything here needs and slower to
  arrive. A picture the canvas cannot decode is uploaded as it came rather than refused, because that
  failure belongs to the device and not to the admin's file.
*/
const FOLDER = 'community-pictures'
const MAX_EDGE = 1800
const QUALITY = 0.82
const TOO_BIG = 12 * 1024 * 1024
const KINDS = ['image/jpeg', 'image/png', 'image/webp']

let bucket = null

// One storage handle for the whole session, built the first time a picture is actually picked.
function pictures() {
  if (!bucket) bucket = getStorage(app)
  return bucket
}

function extension(type) {
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  return 'jpg'
}

function refused(error) {
  if (error?.code === 'storage/unauthorized') {
    return 'This bucket does not let a signed-in person write to it, so the picture could not be saved. Allow writes in the Firebase Storage rules.'
  }
  if (error?.code === 'storage/canceled') return 'The upload was stopped, so nothing changed.'
  if (error?.code === 'storage/quota-exceeded') {
    return 'The storage for this project is full, so no new picture could be written.'
  }
  return error?.message || 'The picture could not be uploaded.'
}

// The smaller JPEG a canvas can be coaxed into, or null when this device will not give one.
async function redraw(file) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    if (bitmap.close) bitmap.close()
    const jpeg = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY))
    // Only a genuine saving is a saving: a picture already smaller than this goes as it is.
    if (jpeg && jpeg.size < file.size) return jpeg
  } catch {
    /* canvas or codec unavailable on this device — fall through, never reject */
  }
  return null
}

/*
  Writes one community's picture and returns both halves: `url` is what goes in the row and what the
  hero paints, `path` is where the object sits if anything ever wants to name it. The name is the
  moment of the save, so a replaced picture is a new object rather than an overwrite — an overwritten
  one would keep its address, and a browser holding the old hero would go on painting it.
*/
export async function uploadCommunityPicture({ file, community_id }) {
  if (!community_id) throw new Error('This page has lost which community it belongs to, so nothing was uploaded.')
  if (!file) throw new Error('Choose a picture first.')
  if (!KINDS.includes(file.type)) {
    throw new Error('A community picture has to be a JPEG, a PNG or a WebP — that is what a page can paint with.')
  }
  if (file.size > TOO_BIG) {
    throw new Error(`That file is over ${Math.round(TOO_BIG / (1024 * 1024))} MB. A smaller copy of the same photo will do.`)
  }

  try {
    const prepared = (await redraw(file)) || file
    const path = `${FOLDER}/${community_id}/${Date.now()}.${extension(prepared.type)}`
    const object = ref(pictures(), path)
    await uploadBytes(object, prepared, { contentType: prepared.type || 'image/jpeg' })
    return { path, url: await getDownloadURL(object) }
  } catch (error) {
    throw new Error(refused(error))
  }
}

/*
  The address this app's own bucket wrote, turned back into the path inside it — and nothing else.
  A link to somebody else's bucket, a seeded picture from another site, or an address that is not a
  storage object at all all answer empty, so a picture being replaced can never delete a file this
  project does not own.
*/
export function ownedPath(value) {
  const src = pictureUrl(value)
  if (!src) return ''
  const found = src.match(/\/b\/([^/]+)\/o\/([^?]+)/)
  if (!found) return ''
  const mine = String(app.options?.storageBucket || '')
  if (mine && found[1] !== mine) return ''
  const path = decodeURIComponent(found[2])
  return path.startsWith(`${FOLDER}/`) ? path : ''
}

/*
  Takes the file the row used to point at out of the bucket, once the new address is safely saved.
  Quiet when it fails: a picture nobody is looking at any more costs a few hundred kilobytes, while
  telling an admin their change failed when it did not would be the worse mistake of the two.
*/
export async function dropCommunityPicture(value) {
  const path = ownedPath(value)
  if (!path) return false
  try {
    await deleteObject(ref(pictures(), path))
    return true
  } catch {
    return false
  }
}
