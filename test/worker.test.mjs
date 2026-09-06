import test from "node:test";
import assert from "node:assert/strict";

import worker from "../apps/api/worker.mjs";

test("Worker reads the personal registry and filters standalone skills", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  const plugin = {id: "example", type: "plugin"};
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return Response.json({addons: [plugin, {id: "example-skill", type: "skill"}]});
  };

  try {
    const response = await worker.fetch(new Request("https://bettercodex.test/api/addons"), {});
    assert.equal(response.status, 200);
    assert.equal(requestedUrl, "https://raw.githubusercontent.com/advaitpaliwal/bettercodex-plugins/main/catalog.json");
    const payload = await response.json();
    assert.equal(payload.schemaVersion, 1);
    assert.deepEqual(payload.addons, [plugin]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Worker validates submissions without GitHub token", async () => {
  const response = await worker.fetch(new Request("https://bettercodex.test/api/submit", {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({
      author: "Companion",
      description: "Example raw GitHub theme file.",
      downloadUrl: "https://raw.githubusercontent.com/advaitpaliwal/bettercodex/main/packages/addons/examples/themes/example.theme.css",
      fileName: "example.theme.css",
      name: "Example Theme",
      type: "theme",
      version: "0.1.0",
    }),
  }), {});

  assert.equal(response.status, 202);
  const payload = await response.json();
  assert.equal(payload.mode, "validated");
});

test("Worker sends submission issues to the community plugin repo by default", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({number: 7, html_url: "https://github.com/advaitpaliwal/bettercodex-plugins/issues/7"}), {
      status: 201,
      headers: {"content-type": "application/json"},
    });
  };

  try {
    const response = await worker.fetch(new Request("https://bettercodex.test/api/submit", {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({
        author: "Companion",
        description: "Example raw GitHub theme file.",
        downloadUrl: "https://raw.githubusercontent.com/advaitpaliwal/bettercodex/main/packages/addons/examples/themes/example.theme.css",
        fileName: "example.theme.css",
        name: "Example Theme",
        type: "theme",
        version: "0.1.0",
      }),
    }), {GITHUB_TOKEN: "test-token"});

    assert.equal(response.status, 201);
    assert.equal(requestedUrl, "https://api.github.com/repos/advaitpaliwal/bettercodex-plugins/issues");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
