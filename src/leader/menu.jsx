import Menu from "../components/menu.jsx";

/*
  The menu for the screens of one community you lead: one link above Profile and Log out,
  handing the state built by `adminState` on unchanged — community, name and address, every
  time. Nothing here works out which community you mean: without one there is nothing to lead,
  so the plain menu is what you get and the link never appears.

  Attendance and testimonies are not offered here. They are reached from the dashboard, where
  the community they belong to is already named above them, and a menu that repeated every
  page of one community would bury the way back to all of them.
*/
export default function LeaderMenu({ state }) {
  if (!state.community_id) return <Menu />;

  return (
    <Menu
      heading="Leader"
      items={[{ label: "Leader dashboard", to: "/leader-dashboard", state }]}
    />
  );
}
