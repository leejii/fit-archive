// 이메일 인증 방식. 현재 'magiclink'(이메일 링크 클릭).
//
// OTP ↔ MagicLink 는 발송 API(signInWithOtp)가 동일하고 "검증 단계"만 다르다:
//   - MagicLink: 이메일 링크 클릭 → /auth/callback 에서 exchangeCodeForSession
//   - OTP      : 사용자가 받은 6자리 코드를 verifyOtp 로 확인
//
// OTP('otp')로 되돌리려면: (1) 여기 값을 'otp'로 변경,
// (2) Supabase에서 커스텀 SMTP를 설정해야 이메일 템플릿 편집 잠금이 풀리고,
//     템플릿에 6자리 코드({{ .Token }})를 넣을 수 있다(기본 템플릿은 링크만 표시).
// → 기본(무료) 이메일에서는 템플릿 편집이 막혀 있어 현재는 MagicLink가 무설정으로 동작한다.
export const EMAIL_AUTH_METHOD: "otp" | "magiclink" = "magiclink";
