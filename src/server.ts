// Cloudflare serves the built SPA before invoking this Worker. Blindfold has no
// backend by design - the document never leaves the browser - so only unmatched
// requests reach this fallback.
export default {
  fetch(): Response {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
};
