import Menu from "../components/menu.jsx";

/*
  The menu for the screens of one community that you administer. It is the same slide-over
  everyone else gets, with three links above Profile and Log out that hand the state built
  by `adminState` on unchanged — community, name and address, every time. Nothing here
  works out which community you mean: without one there is nothing to administer, so the
  plain menu is what you get and the three links never appear.
*/
export default function AdminMenu({ state }) {
  if (!state.community_id) return <Menu />;

  return (
    <Menu
      heading="Admin"
      items={[
        { label: "Admin dashboard", to: "/admin-dashboard", state },
        { label: "Testimonies", to: "/admin-testimonies", state },
        { label: "Attendance", to: "/admin-attendance", state },
      ]}
    />
  );
}
