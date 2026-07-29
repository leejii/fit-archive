import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic Link 콜백 라우트 (현재 인증 방식의 검증 단계).
 *
 * - 사용자가 이메일의 로그인 링크를 클릭하면 Supabase가 여기로 리다이렉트한다.
 * - 링크에 담긴 code 를 세션으로 교환(exchangeCodeForSession)한 뒤 홈으로 보낸다.
 * - (OTP 방식으로 되돌리면 검증은 verifyOtp 가 담당하고 이 라우트는 미사용이 된다.)
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
