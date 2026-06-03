/**
 * Creates an authenticated RevenueCat SDK client using the Replit Connectors proxy.
 * The proxy handles OAuth token injection and refresh automatically.
 * Never cache the returned client — tokens expire.
 *
 * The @replit/revenuecat-sdk passes the entire request as a Request object
 * (not via init), so we must read method, url, headers, and body from it.
 */
import { ReplitConnectors } from "@replit/connectors-sdk";
import { createClient } from "@replit/revenuecat-sdk/client";

export async function getUncachableRevenueCatClient() {
  const connectors = new ReplitConnectors();

  const proxiedFetch: typeof fetch = async (input, init) => {
    let url: string;
    let method: string;
    let body: Record<string, unknown> | undefined;

    if (input instanceof Request) {
      // SDK always passes a Request object with init === null
      url = input.url;
      method = input.method.toUpperCase();
      const bodyText = await input.text();
      if (bodyText) {
        try { body = JSON.parse(bodyText); } catch { /* non-JSON body, skip */ }
      }
    } else {
      url = typeof input === "string" ? input : input.toString();
      method = ((init?.method) ?? "GET").toUpperCase();
      if (init?.body && typeof init.body === "string") {
        try { body = JSON.parse(init.body); } catch { /* */ }
      }
    }

    // Strip base URL — proxy only wants the path + query string
    const path = url.replace(/^https?:\/\/[^/]+/, "");

    const proxyResponse = await connectors.proxy("revenuecat", path, {
      method,
      body,
    }) as Response;

    // Read body once and wrap in a fresh Response so the SDK can read it too
    const responseText = await proxyResponse.text();

    return new Response(responseText, {
      status: proxyResponse.status,
      statusText: proxyResponse.statusText,
      headers: { "content-type": "application/json" },
    });
  };

  return createClient({
    baseUrl: "https://api.revenuecat.com/v2",
    fetch: proxiedFetch,
  });
}
