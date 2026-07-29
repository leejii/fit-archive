"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EMAIL_AUTH_METHOD } from "./config";

// 인증 진입점(Server Actions). UI/페이지는 raw supabase 호출 대신 이 모듈만 사용한다.
// 폼 검증 라이브러리(RHF/Zod)는 후보로 보류 — 필드가 소수(이메일·코드)라
// Server Action + 최소 인라인 검증으로 충분하다.

// 아주 단순한 이메일 형식 검사(정밀 검증은 Supabase가 최종 수행).
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * 1단계: 이메일로 인증 발송.
 *
 * - signInWithOtp 는 OTP·MagicLink 공통 발송 API다.
 *   실제로 코드가 오느냐 링크가 오느냐는 Supabase 이메일 템플릿 설정에 달렸다.
 * - emailRedirectTo 는 OTP에는 무해하고, MagicLink 전환 시 콜백 목적지로 재사용된다.
 * - 리다이렉트하지 않고 결과 객체를 반환한다 — UI가 2단계(코드 입력)로 진행해야 하므로.
 */
export async function sendEmailCode(
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = email.trim();
  if (!isValidEmail(trimmed)) {
    return { ok: false, error: "올바른 이메일 주소를 입력해 주세요." };
  }

  const supabase = await createClient();

  // origin 을 요청 헤더에서 구성 → 콜백 URL이 배포 환경(vercel/localhost)에 맞게 자동 결정.
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const origin = host ? `${proto}://${host}` : undefined;

  const { error } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: {
      shouldCreateUser: true,
      // MagicLink 전환 시: 사용자가 클릭할 링크의 목적지(콜백 라우트).
      emailRedirectTo: origin ? `${origin}/auth/callback` : undefined,
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * 2단계: 6자리 코드 검증(OTP 방식 전용).
 *
 * - MagicLink 전환 시: 이 함수 대신 /auth/callback 의 exchangeCodeForSession 이
 *   검증을 담당하므로, 이 단계(코드 입력 UI)는 사용되지 않는다.
 * - 성공 시 홈으로 리다이렉트, 실패 시 에러 반환.
 */
export async function verifyEmailCode(
  email: string,
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  // 방어적 가드: 현재 방식이 OTP가 아니면 코드 검증 경로는 의미가 없다.
  if (EMAIL_AUTH_METHOD !== "otp") {
    return {
      ok: false,
      error: "현재 인증 방식에서는 코드 검증을 사용하지 않습니다.",
    };
  }

  const trimmedEmail = email.trim();
  const trimmedToken = token.trim();
  if (!isValidEmail(trimmedEmail)) {
    return { ok: false, error: "이메일 정보가 올바르지 않습니다." };
  }
  if (!/^\d{6}$/.test(trimmedToken)) {
    return { ok: false, error: "6자리 숫자 코드를 입력해 주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: trimmedEmail,
    token: trimmedToken,
    type: "email",
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  // 성공: 세션 쿠키가 심어졌으니 보호 홈으로 이동.
  redirect("/");
}

/**
 * 로그아웃. 방식(OTP/MagicLink)과 무관하게 동일하다.
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
