const KEY = "kopano.admin";

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

/*
  The three things every admin screen is about: the community it administers, that
  community's name, and the address that opened it. A screen hands over what it has just
  read, then what arrived on the route, and anything still missing comes from the last
  community this browser opened — so a link that lost its state, a bookmark, a reload or
  the back button still land on a community instead of an empty page. What is linked beats
  what is remembered.

  The name is the one exception to filling each field on its own: only a source that is
  talking about THIS community may name it. A heading from one community over the rows of
  another is exactly the mistake these screens must not make, so an unknown name stays
  empty rather than borrowing one.
*/
export function adminState(live, route) {
  const saved = read();
  const sources = [live, route, saved];
  const chosen = sources.find((one) => one?.community_id);
  const community_id = chosen?.community_id || "";
  return {
    community_id,
    name:
      sources
        .filter((one) => one?.community_id === community_id)
        .map((one) => one.name)
        .find(Boolean) || "",
    email: sources.map((one) => one?.email).find(Boolean) || "",
  };
}

/*
  Every admin screen records what it is showing, which is what makes the next one open on
  the same community. A browser that refuses storage just falls back to the link, so this
  stays quiet when it fails.
*/
export function forgetAdmin() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing remembered, nothing to drop */
  }
}

export function rememberAdmin(state) {
  if (!state.community_id) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* nothing to do: the route still carries it for this visit */
  }
}
