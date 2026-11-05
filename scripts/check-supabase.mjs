#!/usr/bin/env node
/**
 * Supabase preflight for ROELIX.
 *
 * Answers one question: is the configured project reachable with the configured
 * key? It checks the shape of the env values (URL, JWT claims, project ref,
 * expiry) and then probes every endpoint the storefront uses, printing the exact
 * HTTP status and error body so a 401 is never mistaken for "the shop is empty".
 *
 * Usage: npm run doctor:supabase
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ok = (text) => `\u001b[32m\u2713\u001b[0m ${text}`;
const bad = (text) => `\u001b[31m\u2717\u001b[0m ${text}`;
const warn = (text) => `\u001b[33m!\u001b[0m ${text}`;

function readEnvFile(file) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return {};
  const values = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

const env = {
  ...readEnvFile(".env"),
  ...readEnvFile(".env.local"),
  ...readEnvFile(".env.development.local"),
  ...process.env,
};

const url = (env.VITE_SUPABASE_URL ?? "").trim();
const key = (env.VITE_SUPABASE_ANON_KEY ?? "").trim();
const problems = [];

console.log("\nROELIX · Supabase preflight\n");

if (!url) {
  problems.push(bad("VITE_SUPABASE_URL is missing. Add it to .env (see .env.example)."));
} else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
  problems.push(bad(`VITE_SUPABASE_URL is not a project URL: ${url}`));
} else if (url.endsWith("/")) {
  problems.push(warn("VITE_SUPABASE_URL ends with a slash; that produces //rest paths."));
} else {
  problems.push(ok(`project URL ${url}`));
}

const hostRef = /^https:\/\/([a-z0-9-]+)\.supabase\.co/.exec(url)?.[1] ?? "";

if (!key) {
  problems.push(bad("VITE_SUPABASE_ANON_KEY is missing. Add it to .env (see .env.example)."));
} else if (key.startsWith("sb_publishable_") || key.startsWith("sb_secret_")) {
  problems.push(ok(`publishable key format (${key.slice(0, 14)}\u2026)`));
  if (key.startsWith("sb_secret_")) {
    problems.push(bad("That is a SECRET key. Never ship it in a VITE_ variable."));
  }
} else {
  const segments = key.split(".");
  if (segments.length !== 3) {
    problems.push(bad(`VITE_SUPABASE_ANON_KEY is not a JWT (${segments.length} segments).`));
  } else {
    let payload = {};
    try {
      payload = JSON.parse(Buffer.from(segments[1], "base64url").toString("utf8"));
    } catch {
      problems.push(bad("VITE_SUPABASE_ANON_KEY payload is not decodable JSON."));
    }
    const expired = typeof payload.exp === "number" && payload.exp * 1000 < Date.now();
    if (payload.role !== "anon") {
      problems.push(bad(`key role is "${payload.role}", expected "anon".`));
    }
    if (payload.ref && hostRef && payload.ref !== hostRef) {
      problems.push(
        bad(`key belongs to project "${payload.ref}" but the URL points at "${hostRef}".`),
      );
    }
    if (expired) {
      problems.push(bad(`key expired on ${new Date(payload.exp * 1000).toISOString()}.`));
    }
    if (!problems.some((line) => line.includes("key"))) {
      problems.push(ok(`anon key for project ${payload.ref ?? hostRef}, signature claims valid`));
    }
  }
}

if (problems.some((line) => line.startsWith("\u001b[31m"))) {
  console.log(problems.join("\n"));
  console.log("\nFix the values in .env, then restart the dev server (Vite reads env at boot).\n");
  process.exit(1);
}

console.log(problems.join("\n"));

const headers = { apikey: key, Authorization: `Bearer ${key}` };
// Every table the storefront reads. `/rest/v1/` is deliberately absent: it is
// service_role only and answers 401 even when the project is perfectly healthy.
const probes = [
  ["products", "/rest/v1/products?select=id,name&limit=3", true],
  ["product_variants", "/rest/v1/product_variants?select=id,sku&limit=1", true],
  ["product_reviews", "/rest/v1/product_reviews?select=id,status&limit=1", true],
  ["profiles", "/rest/v1/profiles?select=id&limit=1", true],
  ["orders", "/rest/v1/orders?select=id&limit=1", true],
  ["auth health", "/auth/v1/health", false],
];

let failures = 0;
console.log("\nendpoint probes (as the anon key, with no user session)\n");

for (const [name, path, countRows] of probes) {
  let status = 0;
  let body = "";
  try {
    const response = await fetch(new URL(path, url), {
      headers,
      signal: AbortSignal.timeout(12_000),
    });
    status = response.status;
    body = (await response.text()).slice(0, 220);
  } catch (error) {
    body = error instanceof Error ? error.message : String(error);
  }

  if (status >= 200 && status < 300) {
    let detail = "";
    if (countRows) {
      try {
        detail = ` (${JSON.parse(body).length} row(s) visible)`;
      } catch {
        detail = "";
      }
    }
    console.log(ok(`${name.padEnd(17)} ${status}${detail}`));
    continue;
  }

  failures += 1;
  console.log(bad(`${name.padEnd(17)} ${status || "no response"} ${body}`));

  if (status === 401) {
    console.log(
      "    \u21b3 401 with a valid key usually means the project's JWT secret was rotated:\n" +
        "      keys still work by apikey header, but any *stored browser session* is now\n" +
        "      unverifiable. Sign out (or clear site data) and the anon key takes over.",
    );
  }
  if (status === 404 || /PGRST205|does not exist/i.test(body)) {
    console.log("    \u21b3 table missing: apply the migrations in supabase/migrations.");
  }
  if (status === 403) {
    console.log("    \u21b3 403 on a table read means RLS has no policy for the anon role.");
  }
}

console.log(
  failures === 0
    ? "\nAll endpoints responded.\n"
    : `\n${failures} endpoint(s) failed. The app falls back to local storage for these.\n`,
);

process.exit(failures === 0 ? 0 : 1);
