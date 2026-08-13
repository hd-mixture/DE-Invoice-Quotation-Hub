import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { refreshToken } = await request.json();

    if (!refreshToken) {
      return NextResponse.json({ error: "Refresh token is required" }, { status: 400 });
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error("Missing Google OAuth credentials");
      return NextResponse.json(
        { error: "Google OAuth credentials not configured on the server." },
        { status: 500 }
      );
    }

    // Refresh Google Access Token
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Error refreshing token with Google:", data);
      return NextResponse.json(
        { error: data.error_description || data.error || "Failed to refresh access token" },
        { status: response.status }
      );
    }

    return NextResponse.json({
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    });
  } catch (error: any) {
    console.error("Token refresh route failure:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
