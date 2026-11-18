import { callGod } from './god.js'
import { downloadExcel, downloadPdf, moment } from './table_files.js'

/*
  Page fetches for the feedback table. Both doors sit on the self tier: the pile is about
  the app rather than about a community, and the people who use it are the ones it is for.
  Nothing here is admin-scoped, and `src/page_functions/god.js` routes the whole `feedback`
  action to `/api/self` for that reason.
*/

// A row as it leaves the browser. The three free-text answers are what the pile is read for,
// so they keep their own columns rather than being merged into one paragraph nobody can sort.
// `email` is written here and deliberately never rendered on screen: it is the proof that the
// note came from a real account, and it belongs in a file somebody chose to download, not on a
// page every signed-in stranger can scroll.
function cells(one) {
  const stars = Math.max(0, Math.min(5, Number(one.stars) || 0))
  return {
    stars,
    rating: `${stars}/5`,
    when: moment(one.created_at),
    email: one.email || 'not recorded',
    solved: one.solves_problem ? 'yes' : 'no',
    most_challenging: one.most_challenging || '',
    improvements: one.improvements || '',
    additions: one.additions || '',
  }
}

export class FeedbackFetch {
  /*
    Seven columns, in the order a reader works down a row: the rating, the date, whether it was
    any good, then the three answers. Only the three prose columns are left to take the rest of
    the PDF page; everything else knows how long it is.

    `email` sits between the rating and the date rather than at the end, because in a file it is
    the column a reader is there to check, and a column at the far right of a wide sheet is the
    one nobody scrolls to.
  */
  static get COLUMNS() {
    return [
      { key: 'rating', head: 'Rating', sheetWidth: 9, pdfWidth: 40 },
      { key: 'email', head: 'Submitted by', sheetWidth: 30, pdfWidth: 105 },
      { key: 'when', head: 'Submitted', sheetWidth: 18, pdfWidth: 88 },
      { key: 'solved', head: 'Solved problem', sheetWidth: 15, pdfWidth: 62 },
      { key: 'most_challenging', head: 'Most challenging', sheetWidth: 46 },
      { key: 'improvements', head: 'Improvements', sheetWidth: 46 },
      { key: 'additions', head: 'Missing', sheetWidth: 46 },
    ]
  }

  async submit({ stars, solves_problem, improvements, additions, most_challenging }) {
    return callGod('feedback', {
      function: 'create',
      stars,
      solves_problem,
      improvements: improvements || null,
      additions: additions || null,
      most_challenging: most_challenging || null,
    })
  }

  async list(limit = 500) {
    return callGod('feedback', { function: 'all', limit })
  }

  /*
    The whole pile, written out. A download is asked for exactly what the screen is showing —
    the same read, the same cap — because a file that quietly carried more than the page would
    leave somebody arguing about a number nobody looked at.

    There is no search on this table, so `dates` is empty: the file is named for the app and
    the day it was written, and the sentence under the title says "every date".
  */
  async #export(kind, limit) {
    const rows = (await this.list(limit)).map(cells)
    const options = {
      title: 'kopano-feedback',
      dates: {},
      columns: FeedbackFetch.COLUMNS,
      empty: 'Nobody has left any feedback yet, so there is nothing to export.',
      noun: { singular: 'note', plural: 'notes' },
      subject: 'App feedback',
    }
    return kind === 'excel' ? downloadExcel(rows, options) : downloadPdf(rows, options)
  }

  exportExcel(limit = 500) {
    return this.#export('excel', limit)
  }

  exportPdf(limit = 500) {
    return this.#export('pdf', limit)
  }
}

