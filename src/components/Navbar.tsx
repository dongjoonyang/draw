"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session) => setUser(session?.user ?? null)
    );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  };

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={`text-sm transition-colors ${
        pathname === href || pathname.startsWith(href + "/")
          ? "text-white font-medium"
          : "text-gray-400 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-6 h-14 flex items-center gap-6">
      <Link href="/" className="text-indigo-400 font-bold text-base mr-2">
        Dream
      </Link>
      {navLink("/figure-drawing", "인체도형화")}
      {navLink("/gallery", "갤러리")}
      {navLink("/community", "커뮤니티")}

      <div className="ml-auto relative" ref={menuRef}>
        {user ? (
          <>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="text-sm text-gray-300 hover:text-white flex items-center gap-1"
            >
              {user.email?.split("@")[0]}
              <span className="text-xs text-gray-500">▾</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 bg-gray-900 border border-gray-700 rounded-lg py-1 w-44 shadow-xl">
                <Link
                  href={`/profile/${user.email?.split("@")[0]}`}
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800"
                >
                  내 프로필
                </Link>
                <Link
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800"
                >
                  대시보드
                </Link>
                <hr className="border-gray-700 my-1" />
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800"
                >
                  로그아웃
                </button>
              </div>
            )}
          </>
        ) : (
          <Link
            href="/auth/login"
            className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg transition-colors"
          >
            로그인
          </Link>
        )}
      </div>
    </nav>
  );
}
