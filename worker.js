const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwQQzX6DTJuOgA2jU3v4WnCC8PWYZ5n9ZUbkXwMzopIFk4HV_oKQ0A5D4vR4mlOzs4/exec";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/catalogo") {
      try {
        const googleUrl =
          APPS_SCRIPT_URL + "?api=catalogoPublico";

        // 1. Pedimos el endpoint sin seguir automáticamente
        // la redirección de Apps Script.
        const firstResponse = await fetch(googleUrl, {
          method: "GET",
          redirect: "manual",
          headers: {
            "Accept": "application/json,text/plain,*/*"
          }
        });

        let response = firstResponse;

        // 2. Apps Script normalmente responde 302 hacia
        // script.googleusercontent.com.
        if (
          firstResponse.status >= 300 &&
          firstResponse.status < 400
        ) {
          const location =
            firstResponse.headers.get("location");

          if (!location) {
            return Response.json(
              {
                ok: false,
                error: "GOOGLE_REDIRECT_WITHOUT_LOCATION",
                status: firstResponse.status
              },
              { status: 502 }
            );
          }

          // 3. Seguimos nosotros mismos la URL exacta
          // proporcionada por Google.
          response = await fetch(location, {
            method: "GET",
            redirect: "manual",
            headers: {
              "Accept": "application/json,text/plain,*/*"
            }
          });
        }

        const text = await response.text();

        let data;

        try {
          data = JSON.parse(text);
        } catch (error) {
          return Response.json(
            {
              ok: false,
              error: "APPS_SCRIPT_RETURNED_NON_JSON",
              googleStatus: response.status,
              googleContentType:
                response.headers.get("content-type") || "",
              finalUrl: response.url,
              location:
                response.headers.get("location") || "",
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
