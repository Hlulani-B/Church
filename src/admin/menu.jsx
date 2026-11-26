import Menu from "../components/menu.jsx";

/*
  The menu for the screens of one community that you administer: two links above Profile and
  Log out, handing the state built by `adminState` on unchanged — community, name and address,
  every time. Nothing here works out which community you mean: without one there is nothing to
  administer, so the plain menu is what you get and the link never appears.

  Deleting all the data is offered to any admin, because being an admin is what gets you to the
  screen; whether this particular admin is the one who opened the community is a question the
  sign-in page and the server ask, and a menu that hid the link would leave an admin wondering
  where the thing they are allowed to do went.

  Attendance and testimonies are not offered here. They are reached from the dashboard, where
  the community they belong to is already named above them, and a menu that repeated every
  page of one community would bury the way back to all of them.
*/
export default function AdminMenu({ state }) {
  if (!state.community_id) return <Menu />;

  return (
    <Menu
      heading="Admin"
      items={[
        { label: "Admin dashboard", to: "/admin-dashboard", state },
        { label: "Delete all data", to: "/delete-community", state },
      ]}
    />
  );
}
