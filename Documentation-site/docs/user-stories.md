# User Stories

User stories for the Church attendance and testimony system, grouped by role.
Story numbers are stable, so they can be referenced from issues and plans.

<!-- Numbered stories use HTML <ol start="n"> because Markdown drops the start
value, which would renumber the leader and admin stories from 1. -->

## Member stories

<ol start="1">
<li>As a member, I want to log in so that my records are linked to me.</li>
<li>As a member, I want to mark myself Attending or Not Attending for the week so that leaders know who is coming.</li>
<li>As a member, I want to pick a reason (Work, Transport, Sick, Family, Other) when I am not attending so that leaders understand why.</li>
<li>As a member, I want to change my availability before the meeting so that I can fix a mistake or a change of plans.</li>
<li>As a member, I want to log a weekly testimony so that it is recorded and not forgotten.</li>
<li>As a member, I want to see my own past attendance and testimonies so that I can track my own consistency.</li>
</ol>

## Leader stories

A leader is a member first. Stories 1 to 6 apply to leaders unchanged: they log
in as themselves, mark their own Attending or Not Attending with a reason, may
correct it before the meeting, log their own testimonies, and see their own
history. The stories below are in addition to that, not instead of it, and they
are the only extra permissions the leader role grants.

<ol start="7">
<li>As a leader, I want to see who is attending, not attending and not yet responded this week so that I can plan the meeting.</li>
<li>As a leader, I want to see each member's monthly attendance so that I can spot patterns.</li>
<li>As a leader, I want to see attendance for the whole fellowship per month so that I can see overall trends.</li>
<li>As a leader, I want to see the reasons members gave for missing so that I can offer the right kind of help (for example, transport or illness).</li>
<li>As a leader, I want to see members who have missed several weeks in a row so that I can follow up early.</li>
<li>As a leader, I want to see who logged a testimony and how often so that I can encourage participation.</li>
<li>As a leader, I want to read the testimonies members share so that I can celebrate and follow up.</li>
</ol>

## Admin stories

<ol start="14">
<li>As an admin, I want to add and remove members so that the list stays current.</li>
<li>As an admin, I want to assign the leader role to certain members so that only leaders see the dashboards.</li>
</ol>

## Suggested MVP (build first)

Stories 1, 2, 3, 5, 7, 8 and 12. That gives you login, weekly availability with
reasons, testimony logging, and a leader view of this week, monthly attendance
per member, and testimony counts. Add the rest after the fellowship has used it
for a few weeks.

## Questions to confirm with Faith

- Should testimonies be private to leaders, or visible to all members?
- What counts as "drifting" (for example, 2 or 3 missed weeks in a row)?
- Is there one fellowship, or several groups under one church?
