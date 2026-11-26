import React from "react";
import { buildFunctionPdf } from "../page_functions/export/function_docs.js";
import { saveBlob, slug, stamp } from "../page_functions/export/save.js";
import ExportButton from "./export_button.jsx";

/*
  One function, saved as a PDF: the button on an opened function that writes out the whole register as
  the leader is reading it, with every payment receipt pasted onto the page at full width and the path
  it came from printed under it.

  It is a thin component on purpose. Reading the tables is `function_docs` job, laying the page out is
  `pdf.js`, naming and saving the file is `save.js`, and the counting-up button is `export_button` —
  what is left here is the one decision that belongs to the screen: what the download is called. The
  register the page already read is handed down with it, so the PDF is written out of what is on the
  screen rather than from a second read that might answer differently.

  The name carries the function's own name and the day it was held, because an archive folder of
  `function-17.pdf` files answers none of the questions a person opens one for. Two functions planned
  under the same name on the same day are rare enough to live with and a duplicate filename is what a
  browser is built for; it adds a number rather than overwriting the first.
*/

export default function DownloadFunctionData({ community_id, function_id, name, detail }) {
  if (!community_id || !function_id) return null;

  async function run({ report }) {
    const { blob, title } = await buildFunctionPdf(
      { community_id, function_id, name, detail },
      { onProgress: report },
    );
    const filename = `${slug(title)}_${stamp()}.pdf`;
    saveBlob(blob, filename);
    return `Saved ${filename}`;
  }

  return (
    <ExportButton
      label="Download this function"
      busyLabel="Writing the PDF"
      run={run}
      title="Save this function, its register and every receipt as one PDF"
    />
  );
}
