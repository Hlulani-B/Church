import { Router } from 'express'
import supabase from '../supabase.js'

/*
  extra_function_paid — what one extra member owes, and paid, for one planned function. The key is
  the pair (function_id, member_id), so the write is an upsert: one row per person per function,
  revised in place rather than stacked.

  `paid` is required (the row exists to answer that question). A proof is a public file path the
  browser uploads ahead of time and hands over, with `proof_submitted_at` when it went in.
  `confirmed_by` is the real user who checked the proof — so it points at users.email — and
  `confirmed_at` is stamped here, not trusted from the body. `updated_at` moves with every write.
*/

const router = Router()

function isDigits(value) {
  return /^\d+$/.test(String(value ?? '').trim())
}
function day(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '')) ? String(value) : null
}

router.post('/', async (req, res) => {
  const { function_id, member_id, paid, expected_pay_date, proof_path, proof_submitted_at } =
    req.body || {}

  if (!isDigits(function_id)) {
    res.status(400).json({ error: 'bad_function_id', message: 'function_id is the number a planned function is addressed by.' })
    return
  }
  if (!member_id || String(member_id).trim() === '') {
    res.status(400).json({ error: 'missing_fields', missing: ['member_id'] })
    return
  }
  if (paid === undefined || paid === null || (typeof paid !== 'boolean' && String(paid).toLowerCase() !== 'true' && String(paid).toLowerCase() !== 'false')) {
    res.status(400).json({ error: 'missing_fields', missing: ['paid'] })
    return
  }
  if (expected_pay_date !== undefined && expected_pay_date !== null && expected_pay_date !== '' && !day(expected_pay_date)) {
    res.status(400).json({ error: 'bad_date', message: 'expected_pay_date must be YYYY-MM-DD' })
    return
  }

  const { data, error } = await supabase
    .from('extra_function_paid')
    .upsert(
      {
        function_id: Number(String(function_id).trim()),
        member_id: String(member_id).trim(),
        paid: paid === true || String(paid).toLowerCase() === 'true',
        expected_pay_date: day(expected_pay_date) || null,
        proof_path: proof_path ? String(proof_path) : null,
        proof_submitted_at: proof_submitted_at ? String(proof_submitted_at) : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'function_id,member_id' },
    )
    .select()

  if (error) {
    res.status(500).json({ error: 'write_failed', message: error.message })
    return
  }
  if (!data?.length) {
    res.status(500).json({ error: 'write_failed', message: 'The record did not come back.' })
    return
  }
  res.status(201).json(data[0])
})

/*
  Every extra member's payment for one function, named: the person comes joined off extra_members,
  which does carry the key, and the confirmer is read separately, which is the half that cannot be
  joined.

  Nothing in the schema ties `confirmed_by` to users(email) — the table was built without that
  foreign key — so an embedded `users!extra_function_paid_confirmed_by_fkey(...)` does not merely
  come back empty, it fails the whole read with "Could not find a relationship between
  'extra_function_paid' and 'users' in the schema cache", and the section shows nothing at all. The
  addresses on the rows are therefore gathered and asked for in one `in` read, the way the leader's
  function register names its people, and every row is handed back the same confirmed shape the
  page already reads. An address with no user row keeps the address, rather than losing its name.
*/
router.get('/', async (req, res) => {
  const { function_id } = req.query
  if (!isDigits(function_id)) {
    res.status(400).json({ error: 'bad_function_id', message: 'function_id is required, as a number.' })
    return
  }
  const { data, error } = await supabase
    .from('extra_function_paid')
    .select(
      'function_id, member_id, paid, expected_pay_date, proof_path, proof_submitted_at, confirmed_by, confirmed_at, created_at, updated_at, extra_members(name, surname)',
    )
    .eq('function_id', Number(String(function_id).trim()))
    .order('created_at')
  if (error) {
    res.status(500).json({ error: 'read_failed', message: error.message })
    return
  }

  const rows = data || []
  const checked = [...new Set(rows.map((one) => one.confirmed_by).filter(Boolean))]
  if (!checked.length) {
    res.json(rows.map((one) => ({ ...one, confirmed: null })))
    return
  }

  const { data: people, error: peopleError } = await supabase
    .from('users')
    .select('email, name, surname')
    .in('email', checked)
  if (peopleError) {
    res.status(500).json({ error: 'read_failed', message: peopleError.message })
    return
  }

  // Lower-cased on both sides: confirm() stores the address in that shape, and a users row written
  // by hand need not have been.
  const called = new Map((people || []).map((one) => [String(one.email).toLowerCase(), one]))
  res.json(
    rows.map((one) => ({
      ...one,
      confirmed: (one.confirmed_by && called.get(String(one.confirmed_by).toLowerCase())) || null,
    })),
  )
})

/*
  Revising one row. Only the columns a page can change are read off the body; `confirmed_at` is
  stamped here the moment a `confirmed_by` arrives, so nobody sets their own confirmation time.
*/
router.patch('/', async (req, res) => {
  const {
    function_id,
    member_id,
    paid,
    expected_pay_date,
    proof_path,
    proof_submitted_at,
    confirmed_by,
  } = req.body || {}

  if (!isDigits(function_id) || !member_id) {
    res.status(400).json({ error: 'missing_fields', missing: ['function_id', 'member_id'] })
    return
  }

  const changes = { updated_at: new Date().toISOString() }
  if (paid !== undefined) changes.paid = paid === true || String(paid).toLowerCase() === 'true'
  if (expected_pay_date !== undefined) {
    if (expected_pay_date === null || expected_pay_date === '') changes.expected_pay_date = null
    else if (!day(expected_pay_date)) {
      res.status(400).json({ error: 'bad_date', message: 'expected_pay_date must be YYYY-MM-DD' })
      return
    } else changes.expected_pay_date = day(expected_pay_date)
  }
  if (proof_path !== undefined) changes.proof_path = proof_path ? String(proof_path) : null
  if (proof_submitted_at !== undefined) {
    changes.proof_submitted_at = proof_submitted_at ? String(proof_submitted_at) : null
  }
  if (confirmed_by !== undefined) {
    changes.confirmed_by = confirmed_by ? String(confirmed_by).trim().toLowerCase() : null
    changes.confirmed_at = confirmed_by ? new Date().toISOString() : null
  }

  const { data, error } = await supabase
    .from('extra_function_paid')
    .update(changes)
    .eq('function_id', Number(String(function_id).trim()))
    .eq('member_id', String(member_id).trim())
    .select()

  if (error) {
    res.status(500).json({ error: 'update_failed', message: error.message })
    return
  }
  if (!data?.length) {
    res.status(404).json({ error: 'not_found', message: 'No such payment record.' })
    return
  }
  res.json(data[0])
})

// Dropping one payment record.
router.delete('/', async (req, res) => {
  const { function_id, member_id } = req.body || {}
  if (!isDigits(function_id) || !member_id) {
    res.status(400).json({ error: 'missing_fields', missing: ['function_id', 'member_id'] })
    return
  }
  const { error } = await supabase
    .from('extra_function_paid')
    .delete()
    .eq('function_id', Number(String(function_id).trim()))
    .eq('member_id', String(member_id).trim())
  if (error) {
    res.status(500).json({ error: 'delete_failed', message: error.message })
    return
  }
  res.json({ removed: true })
})

export default router
