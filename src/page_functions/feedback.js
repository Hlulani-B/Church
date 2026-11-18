import { callGod } from './god.js'

/*
  Page fetches for the feedback table. `submit` is what any signed-in person may do for
  themselves (self tier); `list` is an admin's read (admin tier) — src/page_functions/god.js
  routes the two doors apart on `function`, so this file does not need to know.
*/
export class FeedbackFetch {
  async submit({ stars, solves_problem, improvements, additions, most_challenging, include_email }) {
    return callGod('feedback', {
      function: 'create',
      stars,
      solves_problem,
      improvements: improvements || null,
      additions: additions || null,
      most_challenging: most_challenging || null,
      include_email: Boolean(include_email),
    })
  }

  async list(limit = 500) {
    return callGod('feedback', { function: 'all', limit })
  }
}
