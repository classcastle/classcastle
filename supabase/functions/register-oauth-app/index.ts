import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.0";

const allowedOrigins = new Set([
  "https://classcastle.org",
  "https://devlabs.classcastle.org",
  "https://devlabsclasscastle.pages.dev",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
]);

function corsHeaders(request: Request) {
  const requestOrigin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(requestOrigin)
      ? requestOrigin
      : "https://classcastle.org",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(
  request: Request,
  status: number,
  body: Record<string, unknown>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Content-Type": "application/json",
    },
  });
}

function configuredKey(
  jsonName: string,
  fallbackNames: string[],
): string | undefined {
  const jsonValue = Deno.env.get(jsonName);
  if (jsonValue) {
    try {
      const parsed = JSON.parse(jsonValue);
      if (typeof parsed?.default === "string") return parsed.default;
      if (parsed && typeof parsed === "object") {
        const first = Object.values(parsed).find(
          (value): value is string => typeof value === "string",
        );
        if (first) return first;
      }
    } catch {
      // Fall through to the explicit variable names.
    }
  }

  return fallbackNames
    .map((name) => Deno.env.get(name))
    .find((value): value is string => Boolean(value));
}

function validateInput(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const iconUri =
    typeof body.iconUri === "string" ? body.iconUri.trim() : "";
  const redirectUri =
    typeof body.redirectUri === "string" ? body.redirectUri.trim() : "";
  const scopes = Array.isArray(body.scopes)
    ? [...new Set(body.scopes.filter(
        (scope): scope is string =>
          typeof scope === "string" &&
          /^[a-z][a-z0-9._:-]*$/.test(scope),
      ))]
    : [];

  if (!name || name.length > 100) {
    return { error: "App name is required and must be 100 characters or fewer." };
  }

  if (iconUri) {
    try {
      const icon = new URL(iconUri);
      if (icon.protocol !== "https:") {
        return { error: "App icons must use an HTTPS URL." };
      }
    } catch {
      return { error: "Enter a valid app icon URL." };
    }
  }

  let redirect: URL;
  try {
    redirect = new URL(redirectUri);
  } catch {
    return { error: "Enter a valid redirect URL." };
  }

  const localhost = ["localhost", "127.0.0.1", "[::1]"].includes(
    redirect.hostname,
  );
  if (redirect.protocol !== "https:" && !localhost) {
    return { error: "Production redirect URLs must use HTTPS." };
  }

  if (!scopes.length) {
    return { error: "Select at least one OAuth scope." };
  }

  return { name, iconUri, redirectUri, scopes };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request) });
  }
  if (request.method !== "POST") {
    return json(request, 405, { error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = configuredKey("SUPABASE_PUBLISHABLE_KEYS", [
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
  ]);
  const secretKey = configuredKey("SUPABASE_SECRET_KEYS", [
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]);
  const authorization = request.headers.get("Authorization");

  if (!supabaseUrl || !publishableKey || !secretKey) {
    return json(request, 500, { error: "Function environment is not configured." });
  }
  if (!authorization?.startsWith("Bearer ")) {
    return json(request, 401, { error: "Authentication required." });
  }

  const accessToken = authorization.replace(/^Bearer\s+/i, "");
  const userClient = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } =
    await userClient.auth.getUser(accessToken);

  if (userError || !userData.user) {
    return json(request, 401, { error: "Your session is no longer valid." });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json(request, 400, { error: "Invalid JSON request body." });
  }

  if (body.action === "list") {
    const { data, error } = await adminClient
      .from("oauth_app_owners")
      .select("client_id, name, redirect_uris, scopes, created_at")
      .eq("owner_id", userData.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return json(request, 500, {
        error: `Could not load your OAuth apps: ${error.message}`,
      });
    }
    return json(request, 200, {
      apps: (data || []).map((app) => ({ ...app, icon_uri: null })),
    });
  }

  if (body.action === "list_authorized") {
    const grantsResponse = await fetch(
      `${supabaseUrl}/auth/v1/user/oauth/grants`,
      {
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    const grants = await grantsResponse.json().catch(() => []);

    if (!grantsResponse.ok) {
      return json(request, grantsResponse.status, {
        error: grants?.msg || grants?.message || "Could not load authorized apps.",
      });
    }
    return json(request, 200, { grants: Array.isArray(grants) ? grants : [] });
  }

  if (body.action === "revoke_authorized") {
    const clientId =
      typeof body.clientId === "string" ? body.clientId.trim() : "";
    if (!clientId) {
      return json(request, 400, { error: "OAuth client ID is required." });
    }

    const revokeResponse = await fetch(
      `${supabaseUrl}/auth/v1/user/oauth/grants?client_id=${encodeURIComponent(clientId)}`,
      {
        method: "DELETE",
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!revokeResponse.ok) {
      const revokeResult = await revokeResponse.json().catch(() => ({}));
      return json(request, revokeResponse.status, {
        error: revokeResult.msg || revokeResult.message ||
          "Could not revoke the authorized app.",
      });
    }

    return json(request, 200, { revoked: true, client_id: clientId });
  }

  if (body.action === "delete_owned") {
    const clientId =
      typeof body.clientId === "string" ? body.clientId.trim() : "";
    if (!clientId) {
      return json(request, 400, { error: "OAuth client ID is required." });
    }

    const { data: ownedApp, error: ownerLookupError } = await adminClient
      .from("oauth_app_owners")
      .select("client_id")
      .eq("client_id", clientId)
      .eq("owner_id", userData.user.id)
      .maybeSingle();

    if (ownerLookupError) {
      return json(request, 500, { error: "Could not verify OAuth app ownership." });
    }
    if (!ownedApp) {
      return json(request, 404, { error: "OAuth app not found." });
    }

    const deleteResponse = await fetch(
      `${supabaseUrl}/auth/v1/admin/oauth/clients/${encodeURIComponent(clientId)}`,
      {
        method: "DELETE",
        headers: {
          apikey: secretKey,
          Authorization: `Bearer ${secretKey}`,
        },
      },
    );

    if (!deleteResponse.ok && deleteResponse.status !== 404) {
      const deleteResult = await deleteResponse.json().catch(() => ({}));
      return json(request, deleteResponse.status, {
        error: deleteResult.msg || deleteResult.message ||
          "Could not delete the OAuth app.",
      });
    }

    const { error: deleteOwnerError } = await adminClient
      .from("oauth_app_owners")
      .delete()
      .eq("client_id", clientId)
      .eq("owner_id", userData.user.id);

    if (deleteOwnerError) {
      return json(request, 500, {
        error: "The OAuth app was deleted but its ownership record could not be removed.",
      });
    }

    return json(request, 200, { deleted: true, client_id: clientId });
  }

  const input = validateInput(body);
  if ("error" in input) return json(request, 400, { error: input.error });

  const registrationResponse = await fetch(
    `${supabaseUrl}/auth/v1/admin/oauth/clients`,
    {
      method: "POST",
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_name: input.name,
        ...(input.iconUri ? { logo_uri: input.iconUri } : {}),
        redirect_uris: [input.redirectUri],
        client_type: "confidential",
        token_endpoint_auth_method: "client_secret_basic",
        scope: input.scopes.join(" "),
      }),
    },
  );
  const registration = await registrationResponse.json().catch(() => ({}));

  if (!registrationResponse.ok) {
    return json(request, registrationResponse.status, {
      error: registration.msg || registration.message || registration.error ||
        "Could not register the OAuth app.",
    });
  }
  if (!registration.client_id || !registration.client_secret) {
    return json(request, 502, {
      error: "Supabase returned incomplete OAuth client credentials.",
    });
  }

  let { error: ownerError } = await adminClient
    .from("oauth_app_owners")
    .insert({
      client_id: registration.client_id,
      owner_id: userData.user.id,
      name: registration.client_name || input.name,
      icon_uri: registration.logo_uri || input.iconUri || null,
      redirect_uris: registration.redirect_uris || [input.redirectUri],
      scopes: input.scopes,
    });

  if (ownerError?.message?.includes("icon_uri")) {
    const fallbackInsert = await adminClient
      .from("oauth_app_owners")
      .insert({
        client_id: registration.client_id,
        owner_id: userData.user.id,
        name: registration.client_name || input.name,
        redirect_uris: registration.redirect_uris || [input.redirectUri],
        scopes: input.scopes,
      });
    ownerError = fallbackInsert.error;
  }

  if (ownerError) {
    return json(request, 500, {
      error: "The OAuth client was created but could not be linked to your account.",
    });
  }

  return json(request, 201, {
    client_id: registration.client_id,
    client_secret: registration.client_secret,
    name: registration.client_name || input.name,
    icon_uri: registration.logo_uri || input.iconUri || null,
    redirect_uris: registration.redirect_uris || [input.redirectUri],
    scopes: input.scopes,
  });
});
