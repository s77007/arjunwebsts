// Tiny CMS for the portfolio.
//
// Text content  -> KV key "overrides" (JSON), applied as string replacement on the rendered HTML.
// Images        -> KV keys "img:<key>" (binary), served from /images/<key>.
//
// Empty KV produces byte-identical output to the original site.
// Everything lives in the one KV namespace already bound as CONTENT — no extra services.

export const FIELDS = [
  {
    key: "aboutHeading",
    label: "About — page heading",
    page: "/about",
    find: "<h1>About Me</h1>",
    def: "<h1>About Me</h1>",
    multiline: false,
  },
  {
    key: "aboutP1",
    label: "About — paragraph 1",
    page: "/about",
    find: "<p>I'm Arjun, a developer and creative technologist who loves building things that live on the web. I enjoy the full process \u2014 from designing interfaces to deploying scalable services on the edge.</p>",
    def: "<p>I'm Arjun, a developer and creative technologist who loves building things that live on the web. I enjoy the full process \u2014 from designing interfaces to deploying scalable services on the edge.</p>",
    multiline: true,
  },
  {
    key: "aboutP2",
    label: "About — paragraph 2",
    page: "/about",
    find: "<p>Beyond code, I'm passionate about photography, playing the piano, and exploring the mountains. This site is a collection of all the things I care about.</p>",
    def: "<p>Beyond code, I'm passionate about photography, playing the piano, and exploring the mountains. This site is a collection of all the things I care about.</p>",
    multiline: true,
  },
];

// Every image key used by worker.js. Each <img> in the source carries a
// matching "<!-- image: <key> -->" comment so you can trace it.
export const IMAGE_FIELDS = [
  { key: "person", label: "About — portrait" },
  { key: "project", label: "Projects — hero image" },
  { key: "photography", label: "Photography — camera" },
  { key: "piano", label: "Music — piano" },
  { key: "mountain", label: "Nature — mountains" },
];

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function authorized(request, env) {
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Basic ")) return false;
  let decoded = "";
  try {
    decoded = atob(header.slice(6));
  } catch {
    return false;
  }
  const password = decoded.slice(decoded.indexOf(":") + 1);
  return Boolean(env.ADMIN_PASSWORD) && password === env.ADMIN_PASSWORD;
}

function requireAuth(env) {
  if (!env.ADMIN_PASSWORD) {
    return new Response("ADMIN_PASSWORD secret is not set on this Worker.", { status: 500 });
  }
  return null;
}

function challenge() {
  return new Response("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="arjunweb admin", charset="UTF-8"' },
  });
}

const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

async function uploadedKeys(env) {
  const manifest = (await env.CONTENT.get("img:manifest", "json")) || [];
  return Array.isArray(manifest) ? manifest : [];
}

export async function renderAdmin(request, env) {
  const missing = requireAuth(env);
  if (missing) return missing;
  if (!authorized(request, env)) return challenge();

  const url = new URL(request.url);
  const overrides = (await env.CONTENT.get("overrides", "json")) || {};
  const uploaded = await uploadedKeys(env);

  const groups = {};
  for (const f of FIELDS) (groups[f.page] ||= []).push(f);

  const textSections = Object.entries(groups)
    .map(([page, fields]) => {
      const rows = fields
        .map((f) => {
          const value = overrides[f.key] ?? f.def;
          const input = f.multiline
            ? `<textarea name="${f.key}" rows="4">${esc(value)}</textarea>`
            : `<input name="${f.key}" value="${esc(value)}">`;
          return `<label><span>${esc(f.label)}</span>${input}</label>`;
        })
        .join("");
      return `<fieldset><legend>Text \u2014 ${esc(page)}</legend>${rows}</fieldset>`;
    })
    .join("");

  const imageRows = IMAGE_FIELDS.map((img) => {
    const isUp = uploaded.includes(img.key);
    const state = isUp
      ? `<span class="on">custom image</span> \u00b7 <a href="/images/${img.key}" target="_blank">preview</a>`
      : `<span class="off">default illustration</span>`;
    const remove = isUp
      ? `<button class="danger" formaction="/admin/image/delete" name="key" value="${img.key}" type="submit">Remove</button>`
      : "";
    return `<div class="imgrow">
      <div><strong>${esc(img.label)}</strong><div class="meta">key: <code>${img.key}</code> \u00b7 ${state}</div></div>
      <div class="actions">
        <input type="file" name="file_${img.key}" accept="image/*">
        <button name="key" value="${img.key}" formaction="/admin/image" type="submit">Upload</button>
        ${remove}
      </div>
    </div>`;
  }).join("");

  const notice =
    url.searchParams.get("saved") ? `<p class="ok">Text saved.</p>` :
    url.searchParams.get("uploaded") ? `<p class="ok">Image uploaded.</p>` :
    url.searchParams.get("removed") ? `<p class="ok">Image removed \u2014 back to the default illustration.</p>` :
    url.searchParams.get("error") ? `<p class="err">${esc(url.searchParams.get("error"))}</p>` : "";

  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Content editor</title>
<style>
body{font:16px/1.5 system-ui,sans-serif;max-width:820px;margin:40px auto;padding:0 20px;background:#0f1117;color:#e6e8ee}
h1{font-size:22px}fieldset{border:1px solid #2a2f3a;border-radius:10px;margin:0 0 20px;padding:16px}
legend{color:#8b93a7;font-size:13px;text-transform:uppercase;letter-spacing:.08em}
label{display:block;margin:14px 0}label span{display:block;font-size:13px;color:#8b93a7;margin-bottom:6px}
input[type=text],input:not([type]),textarea{width:100%;box-sizing:border-box;background:#161a23;border:1px solid #2a2f3a;color:#e6e8ee;border-radius:8px;padding:10px;font:inherit}
button{background:#6c5ce7;color:#fff;border:0;border-radius:8px;padding:10px 18px;font:inherit;font-weight:600;cursor:pointer}
button.danger{background:#3a1f27;color:#f87171}
.imgrow{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:14px 0;border-bottom:1px solid #1e232e}
.imgrow:last-child{border-bottom:0}.meta{font-size:13px;color:#8b93a7;margin-top:4px}
.actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.ok{color:#4ade80}.err{color:#f87171}.on{color:#4ade80}.off{color:#8b93a7}
code{background:#161a23;padding:1px 5px;border-radius:4px}a{color:#8b93a7}
</style></head><body>
<h1>Content editor</h1>${notice}
<form method="POST" action="/admin">${textSections}<button type="submit">Save text</button></form>
<form method="POST" action="/admin/image" enctype="multipart/form-data"><fieldset><legend>Images</legend>${imageRows}</fieldset></form>
<p><a href="/">View site</a></p>
</body></html>`,
    { headers: { "Content-Type": "text/html;charset=UTF-8", "Cache-Control": "no-store" } }
  );
}

export async function saveContent(request, env) {
  const missing = requireAuth(env);
  if (missing) return missing;
  if (!authorized(request, env)) return challenge();

  const form = await request.formData();
  const overrides = (await env.CONTENT.get("overrides", "json")) || {};

  for (const f of FIELDS) {
    const value = form.get(f.key);
    if (typeof value !== "string") continue;
    if (value.trim() === f.def.trim()) delete overrides[f.key];
    else overrides[f.key] = value;
  }

  await env.CONTENT.put("overrides", JSON.stringify(overrides));
  return Response.redirect(new URL("/admin?saved=1", request.url).toString(), 303);
}

export async function uploadImage(request, env) {
  const missing = requireAuth(env);
  if (missing) return missing;
  if (!authorized(request, env)) return challenge();

  const form = await request.formData();
  const key = String(form.get("key") || "");
  const file = form.get(`file_${key}`);

  if (!IMAGE_FIELDS.some((i) => i.key === key)) {
    return Response.redirect(new URL("/admin?error=Unknown+image+key", request.url).toString(), 303);
  }
  if (!(file instanceof File) || file.size === 0) {
    return Response.redirect(new URL("/admin?error=No+file+selected", request.url).toString(), 303);
  }
  if (!file.type.startsWith("image/")) {
    return Response.redirect(new URL("/admin?error=File+must+be+an+image", request.url).toString(), 303);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return Response.redirect(new URL("/admin?error=Image+must+be+under+5MB", request.url).toString(), 303);
  }

  await env.CONTENT.put(`img:${key}`, await file.arrayBuffer(), {
    metadata: { contentType: file.type },
  });

  const manifest = new Set(await uploadedKeys(env));
  manifest.add(key);
  await env.CONTENT.put("img:manifest", JSON.stringify([...manifest]));

  return Response.redirect(new URL("/admin?uploaded=1", request.url).toString(), 303);
}

export async function deleteImage(request, env) {
  const missing = requireAuth(env);
  if (missing) return missing;
  if (!authorized(request, env)) return challenge();

  const form = await request.formData();
  const key = String(form.get("key") || "");
  if (!IMAGE_FIELDS.some((i) => i.key === key)) {
    return Response.redirect(new URL("/admin?error=Unknown+image+key", request.url).toString(), 303);
  }

  await env.CONTENT.delete(`img:${key}`);
  const manifest = (await uploadedKeys(env)).filter((k) => k !== key);
  await env.CONTENT.put("img:manifest", JSON.stringify(manifest));

  return Response.redirect(new URL("/admin?removed=1", request.url).toString(), 303);
}

export async function serveImage(key, env) {
  if (!IMAGE_FIELDS.some((i) => i.key === key)) return new Response("Not found", { status: 404 });

  const { value, metadata } = await env.CONTENT.getWithMetadata(`img:${key}`, "arrayBuffer");
  if (!value) return new Response("Not found", { status: 404 });

  return new Response(value, {
    headers: {
      "Content-Type": metadata?.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=300",
    },
  });
}

export function applyOverrides(html, pathname, overrides, uploaded, SVG) {
  let out = html;

  for (const f of FIELDS) {
    if (f.page !== pathname) continue;
    const value = overrides[f.key];
    if (typeof value === "string" && value.length) out = out.split(f.def).join(value);
  }

  for (const key of uploaded) {
    if (!SVG[key]) continue;
    const dataUri = "data:image/svg+xml;utf8," + encodeURIComponent(SVG[key]);
    out = out.split(dataUri).join(`/images/${key}`);
  }

  return out;
}
