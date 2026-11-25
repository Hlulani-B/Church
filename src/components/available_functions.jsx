import { useNavigate } from "react-router-dom";

/*
  The one button that appears on every dashboard — a member's, a leader's and an admin's — because a
  planned function is a thing everybody in the fellowship is invited to, not a thing only the people
  who run it get to see. It is a button and nothing else so that each dashboard's own `.links` row
  keeps its styling, and it carries the dashboard's heading straight onto the route: which community
  this is can only be learned from the screen that opened the page, the same way the testimonies,
  servings and functions pages learn it.

  It asks nothing about who is clicking. What a person may see of a community's functions is settled
  at /api/self, which reads their address off the token and checks they belong before it lists
  anything — so a button that appeared somewhere it should not would get a refusal, not a list.

  The state it hands over carries the caller's role beside the community, which is nothing at all to
  this list of invitations and everything to the pages behind it: an invitation page can only name the
  dashboard to go back to if the screen that opened it said which one it was.

  The label says both halves — the list and the answer — because the thing people look for on their
  dashboard is the RSVP, and a button named only for the list left them searching for it.
*/
export default function AvailableFunctions({ state }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate("/available-functions", { state })}
    >
      Available functions · RSVP
    </button>
  );
}
