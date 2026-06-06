import { NextRequest, NextResponse } from "next/server";

const OPENF1_BASE = "https://api.openf1.org/v1";

// ── OAuth2 token cache ────────────────────────────────────────────────────────
// Tokens last 1 hour; we refresh 60 s before expiry so no request ever uses a
// stale token. The cache lives at module scope (persists across requests within
// the same Next.js server process).

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  const username = process.env.OPENF1_USERNAME;
  const password = process.env.OPENF1_PASSWORD;
  if (!username || !password) return null;

  // Return cached token if still valid (60 s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.value;
  }

  try {
    const res = await fetch("https://api.openf1.org/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username, password }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const expiresIn = parseInt(data.expires_in, 10) || 3600;
    cachedToken = { value: data.access_token, expiresAt: Date.now() + expiresIn * 1000 };
    return cachedToken.value;
  } catch {
    return null;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const endpoint = path.join("/");
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${OPENF1_BASE}/${endpoint}${searchParams ? "?" + searchParams : ""}`;

  const headers: Record<string, string> = { Accept: "application/json" };
  const token = await getAccessToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(url, { headers, next: { revalidate: 0 } });

    if (!res.ok) {
      // Forward the actual OpenF1 error body so the client can show a useful message.
      const body = await res.json().catch(() => ({ detail: `OpenF1 returned ${res.status}` }));
      return NextResponse.json(body, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return NextResponse.json({ detail: String(err) }, { status: 500 });
  }
}
