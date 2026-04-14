"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/login` },
    });
    if (error) { setError(error.message); setLoading(false); }
    else setDone(true);
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#F8F9FA]">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-8 text-center max-w-sm w-full">
          <div className="text-4xl mb-4">✉️</div>
          <h1 className="text-xl font-bold text-[#141415] mb-2">이메일을 확인해주세요</h1>
          <p className="text-[#6B7280] text-sm mb-1">
            <span className="text-[#141415] font-medium">{email}</span>로 인증 메일을 보냈습니다.
          </p>
          <p className="text-[#9CA3AF] text-sm mb-6">메일의 링크를 클릭하면 가입이 완료됩니다.</p>
          <Link href="/auth/login" className="text-[#3478FF] hover:text-[#1A5FD4] text-sm font-medium">
            로그인 페이지로 →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#F8F9FA]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#141415]">회원가입</h1>
          <p className="text-[#6B7280] text-sm mt-2">Dream 계정을 만들어보세요</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-8">
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#141415] mb-1.5">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-[#141415] text-sm focus:outline-none focus:border-[#3478FF] transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#141415] mb-1.5">비밀번호 (6자 이상)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
                autoComplete="new-password"
                className="w-full bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-[#141415] text-sm focus:outline-none focus:border-[#3478FF] transition-colors"
              />
            </div>
            {error && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#3478FF] hover:bg-[#1A5FD4] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
            >
              {loading ? "가입 중..." : "가입하기"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-[#9CA3AF]">
            이미 계정이 있으신가요?{" "}
            <Link href="/auth/login" className="text-[#3478FF] hover:text-[#1A5FD4] font-medium">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
