import { callGod } from './god.js'

/*
  The page fetches for the functions page. One file per area lives in this folder, and neither
  call here opens Supabase itself: both go to /api/leader, where the caller's own token has to
  belong to a leader or an admin of the community in the body before the read or the write runs.
  A browser cannot list a fellowship's functions, or plan one, by claiming an address in a body.
*/
export class ChurchFunctionsFetch {
  /*
    Every function this community has planned, newest day first, each with how many are going,
    how many have paid and how many gave a date instead. The counts come from the two tables
    under the function, so a function that was created a minute ago is listed with noughts
    rather than left out.
  */
  async getFunctions(community_id) {
    if (!community_id) throw new Error('community_id is required')
    return callGod('church_function', { function: 'list', community_id })
  }

  /*
    Planning one function. The page chooses its name, the day, where it is held and whether it
    costs anything — and, when it does, how much. Who created it is not one of those four: the
    server writes the address off this caller's token, so a page cannot put a function up against
    somebody else's name. Sending `amount` alongside a payment requirement turned off is not
    refused here — /api/leader drops it, because the branch that hides the amount box in the form
    is a convenience and not the rule.
  */
  async createFunction({
    community_id,
    name,
    function_date,
    location,
    requires_payment,
    amount,
  }) {
    if (!community_id) throw new Error('community_id is required')
    return callGod('church_function', {
      function: 'create',
      community_id,
      name,
      function_date,
      location,
      requires_payment,
      amount,
    })
  }

  /*
    One function opened out: its own row, and everybody below it who has answered, with a name
    beside each address. Only the id of the function is sent, and the server answers 400 if that
    is not a number; which community it belongs to is not this page's to claim, because the class
    compares the row's community_id with the one the token was gated on.
  */
  async getFunctionDetails({ community_id, function_id }) {
    if (!community_id) throw new Error('community_id is required')
    if (!function_id) throw new Error('function_id is required')
    return callGod('church_function', { function: 'details', community_id, function_id })
  }
}
