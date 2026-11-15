const css = `
.kp-back{margin-left:auto;align-self:center;display:inline-flex;align-items:center;gap:8px;font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;font-size:14px;font-weight:600;line-height:1;color:inherit;text-decoration:none;border-bottom:1px solid currentColor;padding-bottom:3px;white-space:nowrap;opacity:.8}
.kp-back:hover,.kp-back:focus-visible{opacity:1}
.kp-back .arrow{font-size:16px;line-height:1}
.kp-back .short{display:none}
@media (max-width:620px){
  .kp-back{font-size:13px}
  .kp-back .long{display:none}
  .kp-back .short{display:inline}
}
`;

/*
  The way out of any screen that is about one community, kept where it is seen: the right
  end of the header, on the same line as the menu and the name. It inherits the header's own
  colour, so it reads on the white pages and on the black take-attendance page alike, and it
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
