import React from "react";
import { buildServingsPdf } from "../page_functions/export/servings_docs.js";
import { saveBlob, stamp } from "../page_functions/export/save.js";
import ExportButton from "./export_button.jsx";

/*
  The servings page saved as a PDF: both registers — the members who serve and the extra members who
  do — on one document an admin can keep after the rows are cleared to free up space.

  One file, not a zip. A serving is a person and a role, so there is nothing attached to carry along
  and no reason to unwrap an archive to read a list. The same `pdf.js` the function export uses lays it
  out, which is why the two documents read as one set of paperwork rather than two different products.

  `community_name` comes from the page because the page already knows it and the export module does not:
  a saved file wants the fellowship's name on its first line, not the id the app routes with.
*/

export default function DownloadServingsData({ community_id, community_name }) {
  if (!community_id) return null;

  async function run() {
    const { blob } = await buildServingsPdf({ community_id, community_name });
    const filename = `servings_${stamp()}.pdf`;
    saveBlob(blob, filename);
    return `Saved ${filename}`;
  }

  return (
    <ExportButton
      label="Download servings"
      busyLabel="Writing the PDF"
      run={run}
      title="Save this community's servings, members and extra members, as one PDF"
    />
  );
}
