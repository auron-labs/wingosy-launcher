import http from "node:http";

const saves = [];
const blobs = new Map();
const port = Number(process.env.LUNA_FIXTURE_PORT || "48123");

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(data),
  });
  res.end(data);
}

function bytes(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/zip",
    "content-length": body.length,
  });
  res.end(body);
}

async function read(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function extract(req) {
  const raw = await read(req);
  const type = req.headers["content-type"] || "";
  const match = type.match(/boundary=(?:"([^"]+)"|([^;]+))/);
  if (!match) return { name: "save.zip", data: raw };

  const boundary = Buffer.from(`--${match[1] || match[2]}`);
  const headerEnd = raw.indexOf(Buffer.from("\r\n\r\n"));
  const end = raw.lastIndexOf(Buffer.from(`\r\n${boundary}`));
  const disposition = raw.subarray(0, headerEnd).toString();
  const name = disposition.match(/filename="([^"]+)"/)?.[1] || "save.zip";
  return {
    name,
    data: raw.subarray(headerEnd + 4, end < 0 ? raw.length : end),
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const path = url.pathname;
  console.log("REQUEST", req.method, path, url.search);

  if (req.headers.authorization !== "Bearer fixture-token") {
    console.log(req.method, path, url.search, "-> 401");
    return json(res, 401, { detail: "unauthorized" });
  }

  if (req.method === "GET" && path === "/api/platforms") {
    return json(res, 200, [{ id: 1, slug: "switch", name: "switch", display_name: "Nintendo Switch", rom_count: 1 }]);
  }
  if (req.method === "GET" && path === "/api/roms") {
    return json(res, 200, { total: 1, items: [{
      id: 4242,
      platform_id: 1,
      platform_slug: "switch",
      name: "Luna Save Fixture",
      fs_name: "Luna Save Fixture [0100ABCD12345678].nsp",
      fs_size_bytes: 128,
    }] });
  }
  if (req.method === "GET" && path === "/api/roms/4242") {
    return json(res, 200, {
      id: 4242,
      platform_id: 1,
      platform_slug: "switch",
      name: "Luna Save Fixture",
      fs_name: "Luna Save Fixture [0100ABCD12345678].nsp",
      fs_size_bytes: 128,
      files: [],
    });
  }
  // RomM's list endpoint is intentionally strict: this fixture does not
  // provide the old /api/roms/{rom_id}/saves alias.
  if (
    req.method === "GET" &&
    path === "/api/saves" &&
    url.searchParams.get("rom_id") === "4242"
  ) {
    return json(res, 200, saves);
  }
  // Likewise, only the canonical /api/saves/{id}/content route is served;
  // filename-suffixed and legacy ROM-scoped content routes must 404.
  const contentMatch = /^\/api\/saves\/(\d+)\/content$/.exec(path);
  if (req.method === "GET" && contentMatch) {
    const id = Number(contentMatch[1]);
    return blobs.has(id) ? bytes(res, 200, blobs.get(id)) : json(res, 404, { detail: "missing" });
  }
  if (req.method === "POST" && path === "/api/saves") {
    const parsed = await extract(req);
    const id = 9001 + saves.length;
    const now = new Date().toISOString();
    const save = {
      id,
      rom_id: 4242,
      file_name: parsed.name,
      file_size_bytes: parsed.data.length,
      emulator: "eden",
      created_at: now,
      updated_at: now,
      slot: url.searchParams.get("slot") || "autosave",
    };
    saves.push(save);
    blobs.set(id, parsed.data);
    console.log("CAPTURED", id, parsed.name, parsed.data.length, "bytes");
    return json(res, 200, save);
  }
  if (req.method === "POST" && path.startsWith("/api/saves/") && path.endsWith("/downloaded")) {
    return json(res, 200, { ok: true });
  }
  console.log(req.method, path, url.search, "-> 404");
  return json(res, 404, { detail: "not found" });
});

server.listen(port, "127.0.0.1", () => {
  console.log("STRICT_FIXTURE_LISTENING 127.0.0.1:" + port + " PID", process.pid);
});
