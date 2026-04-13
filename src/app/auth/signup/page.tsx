// src/app/auth/signup/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/login`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setDone(true);
    }
  };

  if (done) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-4">✉️</div>
          <h1 className="text-2xl font-bold text-white mb-3">이메일을 확인해주세요</h1>
          <p className="text-gray-400 text-sm mb-2">
            <span className="text-white">{email}</span>로 인증 메일을 보냈습니다.
          </p>
          <p className="text-gray-500 text-sm">메일의 링크를 클릭하면 가입이 완료됩니다.</p>
          <Link
            href="/auth/login"
            className="mt-8 inline-block text-indigo-400 hover:text-indigo-300 text-sm"
          >
            로그인 페이지로 →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white mb-8 text-center">회원가입</h1>
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">비밀번호 (6자 이상)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              autoComplete="new-password"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2.5">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
          >
            {loading ? "가입 중..." : "가입하기"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-500">
          이미 계정이 있으신가요?{" "}
          <Link href="/auth/login" className="text-indigo-400 hover:text-indigo-300">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
