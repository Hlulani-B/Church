import { useNavigate } from "react-router-dom";

const css = `
.kp-back{margin-left:auto;align-self:center;display:inline-flex;align-items:center;gap:8px;font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;font-size:14px;font-weight:600;line-height:1;color:inherit;text-decoration:none;border-bottom:1px solid currentColor;padding-bottom:3px;white-space:nowrap;opacity:.8}
button.kp-back{background:none;border:0;border-bottom:1px solid currentColor;cursor:pointer}
.kp-back:hover,.kp-back:focus-visible{opacity:1}
.kp-back .arrow{font-size:16px;line-height:1}
.kp-back .short{display:none}
@media (max-width:620px){
  .kp-back{font-size:13px}
  .kp-back .long{display:none}
  .kp-back .short{display:inline}
}
`;

// Which dashboard each community_members role was looking at before it opened a page. The same three
// routes src/page_functions/community.js sends a community card to, kept here rather than re-spelled
// on every page that needs a way out.
const DASHBOARDS = {
  admin: "/admin-dashboard",
  leader: "/leader-dashboard",
  member: "/member-dashboard",
};

/*
  The way out of any screen that is about one community, kept where it is seen: the right
  end of the header, on the same line as the menu and the name. It inherits the header's own
  colour, so it reads on every page it is placed on without needing its own palette, and it
  is a plain link rather than a router navigation because /community is not about the
  community this page was opened for — it is the list all of them come from.
*/
export default function BackToCommunities() {
  return (
    <>
      <style>{css}</style>
      <a className="kp-back" href="/community">
        <span className="arrow" aria-hidden="true">
          &larr;
        </span>
        <span className="long">Back to your communities</span>
        <span className="short">Communities</span>
      </a>
    </>
  );
}

/*
  The way back to the dashboard that opened this page, sitting in the same corner of the header as
  the way back to the communities list and wearing the same words, because it is the same job.

  It needs the role the page was opened with: a dashboard is not one page but three, and only the
  screen that made the navigation knows which of them its reader came from. `state` goes back the way
  it came, so the dashboard opens on the same community rather than on whatever this browser last
  remembered. A page reached without a role — a bookmark, a link typed in — renders nothing at all
  rather than guessing a dashboard, and its caller keeps the communities link.
*/
export function BackToDashboard({ role, state }) {
  const navigate = useNavigate();
  const to = DASHBOARDS[role];
  if (!to) return null;
  return (
    <>
      <style>{css}</style>
      <button type="button" className="kp-back" onClick={() => navigate(to, { state })}>
        <span className="arrow" aria-hidden="true">
          &larr;
        </span>
        <span className="long">Back to the dashboard</span>
        <span className="short">Dashboard</span>
      </button>
    </>
  );
}
