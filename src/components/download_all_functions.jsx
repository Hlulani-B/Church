import React from "react";
import { buildFunctionsArchive } from "../page_functions/export/functions_archive.js";
import { saveBlob, stamp } from "../page_functions/export/save.js";
import ExportButton from "./export_button.jsx";

/*
  The button on the all-functions register that exports every function in the community at once: one
  PDF per function, receipts pasted inside each one, the whole set in a single zip with a contents file
  naming what came out and what did not.

  This is the tool an admin uses before clearing old functions to free up space. Once the rows are
  gone the register cannot be read again at all, so the archive has to carry the answers, the money and
  the proofs together — which is why it goes through the same per-function builder as the single
  download rather than a second, narrower version of the same document.

  It counts up over the functions rather than the files: on a community with sixty plans and three
  hundred receipts, the number a person is watching is how many plans are still to come.
*/

export default function DownloadAllFunctions({ community_id }) {
  if (!community_id) return null;

  async function run({ report }) {
    const { blob, count, asked, failures } = await buildFunctionsArchive(
      { community_id },
      { onProgress: report },
    );
    const filename = `functions_${stamp()}.zip`;
    saveBlob(blob, filename);
    return failures.length
      ? `Saved ${filename} — ${count} of ${asked}; ${failures.length} could not be read`
      : `Saved ${filename} — ${count} ${count === 1 ? "function" : "functions"}`;
  }

  return (
    <ExportButton
      label="Download all functions"
      busyLabel="Building the archive"
      run={run}
      title="Every function as its own PDF, receipts included, in one zip"
    />
  );
}
