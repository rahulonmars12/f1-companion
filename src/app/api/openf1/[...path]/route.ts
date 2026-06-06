import { NextRequest, NextResponse } from "next/server";

const OPENF1_BASE = "https://api.openf1.org/v1";
const API_KEY = process.env.OPENF1_API_KEY;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const endpoint = path.join("/");
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${OPENF1_BASE}/${endpoint}${searchParams ? "?" + searchParams : ""}`;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (API_KEY) headers["Authorization"] = `Bearer ${API_KEY}`;

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
