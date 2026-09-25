const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwQQzX6DTJuOgA2jU3v4WnCC8PWYZ5n9ZUbkXwMzopIFk4HV_oKQ0A5D4vR4mlOzs4/exec";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // API pública del catálogo
    if (url.pathname === "/api/catalogo") {
      try {
        const apiUrl =
          APPS_SCRIPT_URL + "?api=catalogoPublico";

        const response = await fetch(apiUrl, {
          method: "GET",
          redirect: "follow"
        });

        if (!response.ok) {
          return Response.json(
            {
              ok: false,
              error: "CATALOG_API_ERROR",
              status: response.status
            },
            { status: 502 }
          );
        }

        const data = await response.json();

        return Response.json(data, {
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

    // Todo lo demás continúa siendo la web estática actual.
    return env.ASSETS.fetch(request);
  }
};
