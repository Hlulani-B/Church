import React from "react";
import { buildTestimoniesPdf } from "../page_functions/export/testimony_docs.js";
import { saveBlob, stamp } from "../page_functions/export/save.js";
import ExportButton from "./export_button.jsx";

/*
  The testimony pages' archive button, used on all three of them — admin, leader and member.

  It is not a second copy of the existing "Export PDF" beside it. That one writes a flat table of the
  stored rows, which for a testimony means a column of `enc:v1:` ciphertext and a column of bucket urls:
  correct as a database dump, unreadable as a record. This one opens the words with the browser's key and
  pastes the attached files onto the page, which is what an admin needs before the rows are cleared to
  free up space.

  The three pages differ only in who is looking, so the component takes the viewer's address and whether
  they see everything: a member exports the testimonies they are allowed to read, an admin or a leader
  exports the community's whole set. The same rule the list on the screen already follows.
*/

export default function DownloadTestimonies({
  community_id,
  community_name,
  viewer_email = "",
  search = {},
  for_all = false,
  label = "Archive testimonies",
}) {
  if (!community_id) return null;

  async function run({ report }) {
    const { blob, count } = await buildTestimoniesPdf(
      { community_id, community_name, search, viewer_email, for_all },
      { onProgress: report },
    );
    const filename = `testimonies_${stamp()}.pdf`;
    saveBlob(blob, filename);
    return `Saved ${filename} — ${count} ${count === 1 ? "testimony" : "testimonies"}`;
  }

  return (
    <ExportButton
      label={label}
      busyLabel="Opening and pasting…"
      run={run}
      title="Every testimony with its words decrypted and its attached files pasted in, as one PDF"
    />
  );
}
