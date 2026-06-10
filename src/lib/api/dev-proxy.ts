import { getConfiguredApiBaseUrl } from "@/lib/api/base-url";

const FORWARDED_REQUEST_HEADERS = [
  "authorization",
  "x-company-id",
  "content-type",
  "accept",
] as const;

const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function buildUpstreamUrl(pathSegments: string[], search: string): string | null {
  const baseUrl = getConfiguredApiBaseUrl();
  if (!baseUrl.startsWith("http")) {
    return null;
  }

  const path = pathSegments.map((segment) => encodeURIComponent(segment)).join("/");
  return `${baseUrl}/${path}${search}`;
}

function buildForwardHeaders(request: Request): Headers {
  const headers = new Headers();

  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }

  return headers;
}

/** Server-side proxy for browser `/api/*` calls → EMSYS API (all HTTP methods). */
export async function proxyApiRequest(
  request: Request,
  pathSegments: string[],
): Promise<Response> {
  const upstreamUrl = buildUpstreamUrl(pathSegments, new URL(request.url).search);
  if (!upstreamUrl) {
    return Response.json(
      { success: false, message: "Request failed", error: "NEXT_PUBLIC_API_BASE_URL is not configured." },
      { status: 500 },
    );
  }

  const method = request.method.toUpperCase();
  const init: RequestInit = {
    method,
    headers: buildForwardHeaders(request),
    cache: "no-store",
  };

  if (METHODS_WITH_BODY.has(method)) {
    const body = await request.arrayBuffer();
    if (body.byteLength > 0) {
      init.body = body;
    }
  }

  const upstream = await fetch(upstreamUrl, init);
  const responseHeaders = new Headers();
  const contentType = upstream.headers.get("content-type");

  if (contentType) {
    responseHeaders.set("content-type", contentType);
  }

  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}
