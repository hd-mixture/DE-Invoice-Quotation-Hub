import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const iss = url.searchParams.get("iss");
  
  const targetUrl = new URL("/auth/google-callback", url.origin);
  if (code) targetUrl.searchParams.set("code", code);
  if (error) targetUrl.searchParams.set("error", error);
  if (iss) targetUrl.searchParams.set("iss", iss);
  
  return NextResponse.redirect(targetUrl.toString());
}

export async function POST(request: Request) {
  try {
    const { code, redirectUri } = await request.json();

    if (!code) {
      return NextResponse.json({ error: "Authorization code is required" }, { status: 400 });
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const finalRedirectUri = redirectUri || process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !finalRedirectUri) {
      console.error("Missing Google OAuth environment variables");
      return NextResponse.json(
        { error: "Google OAuth is not fully configured on the server. Please check .env.local setup." },
        { status: 500 }
      );
    }

    // Exchange authorization code for tokens
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: finalRedirectUri,
        grant_type: "authorization_code",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Error exchanging OAuth code with Google:", data);
      return NextResponse.json(
        { error: data.error_description || data.error || "Failed to exchange code" },
        { status: response.status }
      );
    }

    // Return the tokens: access_token, refresh_token, id_token, expires_in
    return NextResponse.json({
      accessToken: data.access_token,
      refreshToken: data.refresh_token || null, // Will only be present on first login/consent
      idToken: data.id_token,
      expiresIn: data.expires_in,
    });
  } catch (error: any) {
    console.error("OAuth callback route failure:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
