const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwQQzX6DTJuOgA2jU3v4WnCC8PWYZ5n9ZUbkXwMzopIFk4HV_oKQ0A5D4vR4mlOzs4/exec";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/catalogo") {
      try {
        const googleUrl =
          APPS_SCRIPT_URL + "?api=catalogoPublico";

        const response = await fetch(googleUrl, {
          method: "GET",
          redirect: "follow",
          headers: {
            "Accept": "application/json,text/plain,*/*"
          }
        });

        const text = await response.text();

        // Si Google devuelve algo que no sea JSON,
        // mostramos información útil para diagnosticarlo.
        let data;

        try {
          data = JSON.parse(text);
        } catch (parseError) {
          return Response.json(
            {
              ok: false,
              error: "APPS_SCRIPT_RETURNED_NON_JSON",
              googleStatus: response.status,
              googleContentType:
                response.headers.get("content-type") || "",
              finalUrl: response.url,
              preview: text.substring(0, 500)
            },
            { status: 502 }
          );
        }

        return Response.json(data, {
          status: 200,
          headers: {
            "Cache-Control": "public, max-age=60"
          }
        });

      } catch (error) {
        return Response.json(
          {
            ok: false,
            error: "CATALOG_PROXY_ERROR",
            message: String(error)
          },
          { status: 502 }
        );
      }
    }

    return env.ASSETS.fetch(request);
  }
};
