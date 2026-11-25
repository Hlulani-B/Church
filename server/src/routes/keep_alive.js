import { Router } from 'express'
import supabase from '../supabase.js'

/*
  The keep-alive write: put the number 4 in the `addition` column of `keep-alive`, and then take the
  row straight back out again.

  Two things it is for. The service is on Render's free plan, which puts a web process to sleep after
  a stretch without requests, so something has to knock on it on a timer — and the knock is what this
  route answers, rather than an empty /health poll that proves nothing except that the process woke
  up. And because the knock writes, the trip exercises the whole path: url, process, Supabase client,
  service key, insert, delete. A heartbeat that only answers `ok` can lie about the database being
  reachable; one that lands a row and takes it away again cannot.

  The row does not stay, because the timer fires every ten minutes and a table of 4s is 144 rows a day
  saying nothing that the log line below does not already say. So the proof is not in the table — it is
  in the server's log and in the workflow run being green. Deleting is the last thing this route can
  fail at, so a run that goes red on `delete_failed` means the heartbeat is working and the cleanup is
  not, which is a different message from `insert_failed` and is answered as one.

  Nothing about the caller is recorded, and nothing is asked of them: the route sits on the same
  ungated server as /servings, so anyone who knows the url can make it write and delete. That is the
  deal this deployment has always struck (see the note in the root render.yaml) and this route does not
  change it — 4 is the only value it will ever put down, and it takes nothing in.
*/

const router = Router()

router.post('/', async (req, res) => {
  const { data, error } = await supabase
    .from('keep-alive')
    .insert({ addition: 4 })
    .select()

  if (error) {
    console.error('keep-alive write failed:', error.message)
    res.status(500).json({ error: 'insert_failed', message: error.message })
    return
  }
  if (!data?.length) {
    // The insert can commit and still hand nothing back, which is a failure of the write as the
    // caller experienced it. Saying so beats reporting a heartbeat the table never got.
    console.error('keep-alive write failed: no row came back')
    res.status(500).json({ error: 'insert_failed', message: 'The keep-alive row did not come back.' })
    return
  }

  console.log('2 + 2 = 4 has been written in the database')

  // `id` is the table's own key, which is why the row is taken back out by that and not by counting
  // 4s: an insert returns exactly the rows it wrote, so this deletes exactly the row it made.
  const gone = await supabase.from('keep-alive').delete().eq('id', data[0].id)
  if (gone.error) {
    console.error('keep-alive cleanup failed:', gone.error.message)
    res.status(500).json({
      error: 'delete_failed',
      message: `4 was written and not cleaned up: ${gone.error.message}`,
    })
    return
  }

  res.status(201).json({
    written: data[0],
    removed: true,
    message: '2 + 2 = 4 has been written in the database',
  })
})

export default router
