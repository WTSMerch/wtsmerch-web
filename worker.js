const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwQQzX6DTJuOgA2jU3v4WnCC8PWYZ5n9ZUbkXwMzopIFk4HV_oKQ0A5D4vR4mlOzs4/exec";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/catalogo") {
      try {
        // Evitamos reutilizar/cachar la URL temporal de Google.
        const sourceUrl =
          APPS_SCRIPT_URL +
          "?api=catalogoPublico&_=" +
          Date.now();

        const response = await fetch(sourceUrl, {
          method: "GET",
          redirect: "follow",
          cf: {
            cacheTtl: 0,
            cacheEverything: false
          },
          headers: {
            "Accept": "application/json"
          }
        });

        const text = await response.text();

        if (!response.ok) {
          return Response.json({
            ok: false,
            error: "GOOGLE_HTTP_ERROR",
            status: response.status,
            finalUrl: response.url,
            preview: text.substring(0, 300)
          }, { status: 502 });
        }

        try {
          const data = JSON.parse(text);

          return Response.json(data, {
            headers: {
              "Cache-Control": "no-store"
            }
          });

        } catch (e) {
          return Response.json({
            ok: false,
            error: "GOOGLE_NON_JSON",
            status: response.status,
            finalUrl: response.url,
            contentType: response.headers.get("content-type"),
            preview: text.substring(0, 300)
          }, { status: 502 });
        }

      } catch (e) {
        return Response.json({
          ok: false,
          error: "PROXY_FETCH_FAILED",
          message: String(e)
        }, { status: 502 });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
