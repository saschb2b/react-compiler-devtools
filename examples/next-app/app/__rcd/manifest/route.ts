import { NextResponse } from "next/server";
import { lookupCollector } from "@rcd/next-plugin";
import { resolve } from "node:path";

/**
 * Exposes the manifest at `/__rcd/manifest`. Mirrors `MANIFEST_ENDPOINT`
 * (`/__rcd/manifest.json`) by accepting the trailing extension via Next's
 * dynamic segment behavior — we just rewrite below.
 */
export function GET() {
  const collector = lookupCollector(resolve(process.cwd()));
  return NextResponse.json(collector?.getManifest() ?? null, {
    headers: { "access-control-allow-origin": "*" },
  });
}
