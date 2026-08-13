"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { HomeIcon } from "lucide-react";

export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    // Auto-redirect to main workspace hub after 3 seconds
    const timer = setTimeout(() => {
      router.push("/");
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-tr from-[#f5f3ff] via-[#f8fafc] to-[#fff7ed] dark:bg-none dark:bg-zinc-950 text-slate-900 dark:text-white transition-colors duration-300">
      <div className="max-w-md w-full text-center space-y-6 bg-white/80 dark:bg-zinc-900/90 p-8 sm:p-10 rounded-[36px] shadow-2xl border border-slate-200/80 dark:border-white/10 backdrop-blur-xl">
        <div className="relative inline-flex items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 dark:bg-orange-500/20 text-orange-500 flex items-center justify-center font-black text-2xl border border-orange-500/20">
            404
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight">
            Page Not Found
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium leading-relaxed">
            The page or route you requested does not exist or has moved. Redirecting you to the home dashboard...
          </p>
        </div>

        <div className="pt-2">
          <button
            onClick={() => router.push("/")}
            className="w-full py-3.5 px-6 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-orange-500/20 active:scale-95"
          >
            <HomeIcon className="w-4 h-4" />
            <span>Return to Workspace Hub</span>
          </button>
        </div>
      </div>
    </div>
  );
}
