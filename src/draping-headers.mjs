// These routes only serve shipped app assets. No photo upload route exists.
export function isDrapingPath(path) {
  return path === '/projects/draping-mirror' || path.startsWith('/projects/draping-mirror/');
}

export async function drapingAsset(request, env) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('This experience does not accept uploads.', { status: 405, headers: { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' } });
  }
  const asset = await env.ASSETS.fetch(request);
  const response = new Response(asset.body, asset);
  // A route-scoped replacement avoids concatenating a camera deny rule and an
  // allow rule in _headers. All other pages retain their camera=() baseline.
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()');
  response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  return response;
}
