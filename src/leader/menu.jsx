import Menu from "../components/menu.jsx";

/*
  The menu for the screens of one community you lead. It is the same slide-over everyone else
  gets, with three links above Profile and Log out that hand the state built by `adminState`
  on unchanged — community, name and address, every time. Nothing here works out which
  community you mean: without one there is nothing to lead, so the plain menu is what you get
  and the three links never appear.

  The three destinations are the admin's three, because a leader reads the same things. What a
  leader cannot do — choose a role, remove a person, change the join code — is simply not on
  any of those pages, and /api/god refuses it for a leader whoever asks.
*/
export default function LeaderMenu({ state }) {
  if (!state.community_id) return <Menu />;

  return (
    <Menu
      heading="Leader"
      items={[
        { label: "Leader dashboard", to: "/leader-dashboard", state },
        { label: "Testimonies", to: "/leader-testimonies", state },
        { label: "Attendance", to: "/leader-attendance", state },
      ]}
    />
  );
}
