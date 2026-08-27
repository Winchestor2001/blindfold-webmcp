// Handing bytes to the user.
//
// Kept separate from the export tool so that building the file and delivering it
// are distinct steps: verification builds the same bytes without any of this
// running, which is what lets the check be honest about the file it certifies.

export function downloadBytes(bytes: Uint8Array, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked on a later turn of the event loop; revoking immediately can cancel
  // the download in some builds.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
