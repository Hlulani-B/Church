/*
  Running a batch of slow jobs a few at a time and saying how far along it is. One job.

  Downloading every function means one details read plus a handful of file fetches per function, and a
  community with sixty functions turned into sixty simultaneous requests gets throttled by the browser
  or refused by the server — the failure looks like a random missing receipt, which is the last thing an
  archive should do. So work goes through a fixed number of runners that each pull the next index, and
  results are written back into the original slot rather than pushed, so the archive lists functions in
  the order the page listed them.

  `onProgress` fires once per finished item, which is what lets a button count up while it works instead
  of sitting on a spinner for two minutes with no way to tell whether it is stuck.
*/

export async function mapLimit(items, limit, worker, onProgress) {
  const list = Array.from(items || [])
  const out = new Array(list.length).fill(undefined)
  let next = 0
  let done = 0

  async function runner() {
    while (next < list.length) {
      const index = next++
      try {
        out[index] = { ok: true, value: await worker(list[index], index) }
      } catch (error) {
        // One function failing to read must not cancel the other fifty-nine. The caller gets the
        // error where the result would have been and decides whether to mention it in the archive.
        out[index] = { ok: false, error }
      }
      done += 1
      onProgress?.({ done, total: list.length, index })
    }
  }

  const runners = Array.from({ length: Math.max(1, Math.min(limit || 3, list.length || 1)) }, runner)
  await Promise.all(runners)
  return out
}

// A progress line for a button: `12 / 60`. Returns '' when there is nothing to count yet.
export function ratio({ done = 0, total = 0 }) {
  if (!total) return ''
  return `${done} / ${total}`
}
