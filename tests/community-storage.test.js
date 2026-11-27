import { describe, expect, it, vi } from 'vitest'

/*
  Which saved address is allowed to point at a file this project may delete.

  `dropCommunityPicture` runs after a new picture has been saved, and it removes the object the old
  address pointed at. That makes `ownedPath` the one function standing between an admin pressing Save
  and a file being destroyed, and the row holds whatever the settings page or a seed script ever wrote
  into it — a picsum photograph, somebody's own gallery, an address typed by hand. Only the first
  object of a `community-pictures/...` path inside this project's own bucket belongs to this app, and
  everything else has to answer empty rather than delete something it never made.

  Firebase is mocked because the module is imported for its functions and none of them may be reached
  from a test: nothing here should touch a network or build a real storage handle.
*/

const world = vi.hoisted(() => ({ deleted: [] }))

vi.mock('firebase/storage', () => ({
  getStorage: () => ({ mocked: true }),
  ref: (bucket, path) => ({ bucket, path }),
  uploadBytes: async () => ({ ref: {} }),
  getDownloadURL: async () => 'https://firebasestorage.googleapis.com/nothing',
  deleteObject: vi.fn(async (object) => {
    world.deleted.push(object.path)
  }),
}))

vi.mock('../src/firebase.js', () => ({
  app: { options: { storageBucket: 'kopano-a0554.firebasestorage.app' } },
}))

const { dropCommunityPicture, ownedPath } = await import('../src/page_functions/storage.js')

const MINE =
  'https://firebasestorage.googleapis.com/v0/b/kopano-a0554.firebasestorage.app'
  + '/o/community-pictures%2F7%2F1712345678901.jpg?alt=media&token=6f2a'

describe('ownedPath', () => {
  it('reads a picture this app uploaded back into the path inside the bucket', () => {
    expect(ownedPath(MINE)).toBe('community-pictures/7/1712345678901.jpg')
  })

  it('takes the address even when it was stored unescaped', () => {
    expect(
      ownedPath(
        'https://firebasestorage.googleapis.com/v0/b/kopano-a0554.firebasestorage.app'
          + '/o/community-pictures/7/one.jpg?alt=media',
      ),
    ).toBe('community-pictures/7/one.jpg')
  })

  it('refuses the same path in somebody else\'s bucket', () => {
    expect(
      ownedPath(
        'https://firebasestorage.googleapis.com/v0/b/other-project.appspot.com'
          + '/o/community-pictures%2F7%2F1.jpg?alt=media',
      ),
    ).toBe('')
  })

  it('refuses a folder that is not this app\'s picture folder', () => {
    expect(
      ownedPath(
        'https://firebasestorage.googleapis.com/v0/b/kopano-a0554.firebasestorage.app'
          + '/o/proofs%2F7%2Freceipt.pdf?alt=media',
      ),
    ).toBe('')
  })

  it('refuses a picture hosted anywhere else at all, because this project did not write it', () => {
    expect(ownedPath('https://picsum.photos/seed/streamofhope/1600/900')).toBe('')
    expect(ownedPath('https://images.example.co/hall.jpg')).toBe('')
  })

  it('says nothing for a value that is not an address, and for no value at all', () => {
    expect(ownedPath('community-pictures/7/1.jpg')).toBe('')
    expect(ownedPath('')).toBe('')
    expect(ownedPath(null)).toBe('')
  })
})

describe('dropCommunityPicture', () => {
  it('deletes the one file this app owns, and answers that it did', async () => {
    world.deleted.length = 0
    expect(await dropCommunityPicture(MINE)).toBe(true)
    expect(world.deleted).toEqual(['community-pictures/7/1712345678901.jpg'])
  })

  it('leaves a picture it does not own alone, without asking the bucket for anything', async () => {
    world.deleted.length = 0
    expect(await dropCommunityPicture('https://picsum.photos/seed/gracepoint/1600/900')).toBe(false)
    expect(world.deleted).toEqual([])
  })

  it('is quiet when the bucket refuses, because the row has already been changed', async () => {
    world.deleted.length = 0
    // A path this app wrote, deleted by a bucket that no longer holds it.
    const { deleteObject } = await import('firebase/storage')
    deleteObject.mockImplementationOnce(async () => {
      throw new Error('storage/object-not-found')
    })
    expect(await dropCommunityPicture(MINE)).toBe(false)
    expect(world.deleted).toEqual([])
  })
})
