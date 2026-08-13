"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth, db } from "../../../firebase/config";
import { doc, setDoc } from "firebase/firestore";
import { Loader2, Sparkles, AlertCircle, CheckCircle } from "lucide-react";

function GoogleCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      console.error("Google OAuth error parameter:", error);
      setStatus("error");
      setErrorMessage(error || "Access was denied by Google");
      return;
    }

    if (!code) {
      setStatus("error");
      setErrorMessage("No authorization code was found in the URL callback");
      return;
    }

    const processOAuthCallback = async () => {
      try {
        const dynamicRedirectUri = typeof window !== "undefined" 
          ? `${window.location.origin}/auth/google-callback` 
          : undefined;

        // 1. Exchange authorization code for tokens securely on our backend API
        const tokenResponse = await fetch("/api/auth/google/callback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            code,
            redirectUri: dynamicRedirectUri 
          }),
        });

        let tokenData;
        try {
          tokenData = await tokenResponse.json();
        } catch (parseError) {
          // If the server returns an HTML 500 error page instead of JSON, we catch it here.
          const text = await tokenResponse.clone().text().catch(() => "Unable to read response text.");
          console.error("Failed to parse API response as JSON. Raw response:", text.substring(0, 500));
          throw new Error("The server encountered an internal error and returned an invalid format. Please restart the dev server or try again later.");
        }

        if (!tokenResponse.ok) {
          throw new Error(tokenData?.error || "Failed to exchange authorization code for credentials");
        }

        const { accessToken, refreshToken, idToken } = tokenData;

        setStatus("success");

        // 2. Notify parent dashboard and pass all tokens for parent-side authentication
        setTimeout(() => {
          if (window.opener) {
            window.opener.postMessage(
              {
                type: "google-drive-connected",
                accessToken,
                refreshToken: refreshToken || null,
                idToken,
              },
              window.location.origin
            );
            window.close();
          } else {
            // Fallback: if not opened in a popup, redirect to home
            router.push("/");
          }
        }, 600);

      } catch (err: any) {
        console.error("OAuth callback integration failure:", err);
        setStatus("error");
        setErrorMessage(err.message || "An unexpected error occurred during Google connection");
      }
    };

    processOAuthCallback();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col items-center justify-center p-6 text-center select-none font-sans relative overflow-hidden transition-colors duration-300">
      {/* Background glowing orb gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-violet-600/10 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-600/10 blur-[120px]" />

      <div className="w-full max-w-md bg-white/70 dark:bg-zinc-900/50 border border-slate-200 dark:border-white/10 backdrop-blur-2xl p-8 rounded-3xl shadow-2xl relative z-10 space-y-6 animate-in fade-in duration-300">
        
        {/* Animated Brand Header */}
        <div className="flex flex-col items-center justify-center gap-3 mb-4">
          <img 
            src="/Graphic Assets/DARSHAN ENTERPRISES Logo.jpg" 
            alt="Darshan Enterprises Logo" 
            className="w-16 h-16 rounded-2xl object-cover shadow-lg shadow-violet-500/10 border border-slate-200 dark:border-white/10" 
          />
          <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-zinc-300">Darshan Enterprises</span>
        </div>

        {status === "loading" && (
          <div className="space-y-4 py-4">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <Loader2 className="w-12 h-12 text-violet-600 dark:text-violet-500 animate-spin" />
              <Sparkles className="w-5 h-5 text-emerald-500 dark:text-emerald-400 absolute animate-pulse" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">Connecting Google Drive...</h2>
              <p className="text-slate-500 dark:text-zinc-400 text-xs px-4">Establishing a persistent, secure offline link for seamless automated file backups.</p>
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4 py-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center shadow-lg shadow-emerald-500/5">
              <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-black tracking-tight text-emerald-600 dark:text-emerald-400">Connection Successful!</h2>
              <p className="text-slate-500 dark:text-zinc-400 text-xs px-4">Authorized successfully. Returning you to the Dashboard...</p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4 py-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 mx-auto rounded-full bg-rose-100 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center shadow-lg shadow-rose-500/5">
              <AlertCircle className="w-8 h-8 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-black tracking-tight text-rose-600 dark:text-rose-400">Authentication Failed</h2>
              <p className="text-slate-600 dark:text-zinc-300 text-xs px-2 font-medium">{errorMessage}</p>
              <p className="text-slate-500 dark:text-zinc-500 text-[10px] pt-2 px-4">You may close this window and try connecting Google Drive again from the dashboard.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col items-center justify-center p-6 text-center select-none font-sans relative overflow-hidden transition-colors duration-300">
        <Loader2 className="w-10 h-10 text-violet-600 dark:text-violet-500 animate-spin" />
      </div>
    }>
      <GoogleCallbackContent />
    </Suspense>
  );
}
