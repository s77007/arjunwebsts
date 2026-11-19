// Entry point for arjunwebsts.
//
// Wraps the original portfolio Worker (worker.js) and layers an editable
// content store on top of it:
//
//   /admin            -> password-protected editor (HTTP Basic, ADMIN_PASSWORD secret)
//   /admin/image      -> image upload
//   /admin/image/delete -> revert an image to its default illustration
//   /images/<key>     -> uploaded image bytes (KV)
//   /*                -> rendered by worker.js, then saved overrides applied
//
// If KV is empty the output is byte-identical to the original site.

import base, { SVG } from "./worker.js";
import {
  renderAdmin,
  saveContent,
  uploadImage,
  deleteImage,
  serveImage,
  applyOverrides,
} from "./cms.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // --- admin ---
    if (path === "/admin" || path === "/admin/") {
      if (request.method === "POST") return saveContent(request, env);
      return renderAdmin(request, env);
    }
    if (path === "/admin/image" && request.method === "POST") {
      return uploadImage(request, env);
    }
    if (path === "/admin/image/delete" && request.method === "POST") {
      return deleteImage(request, env);
    }

    // --- uploaded images ---
    if (path.startsWith("/images/")) {
      return serveImage(decodeURIComponent(path.slice("/images/".length)), env);
    }

    // --- site ---
    const res = await base.fetch(request);
    const type = res.headers.get("content-type") || "";
    if (!type.includes("text/html")) return res;

    let overrides = {};
    let uploaded = [];
    try {
      overrides = (await env.CONTENT.get("overrides", "json")) || {};
      uploaded = (await env.CONTENT.get("img:manifest", "json")) || [];
    } catch {
      overrides = {};
      uploaded = [];
    }

    const html = applyOverrides(await res.text(), path, overrides, uploaded, SVG);
    return new Response(html, { status: res.status, headers: res.headers });
  },
};
