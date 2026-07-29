"use client";

import { useState, useTransition } from "react";
import { sendEmailCode, verifyEmailCode } from "@/lib/auth/actions";
import { EMAIL_AUTH_METHOD } from "@/lib/auth/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// 이메일 로그인 UI (인증 방식 인지형).
//   step "email" → 이메일 입력 후 인증 메일 발송(sendEmailCode)
//   그 다음은 EMAIL_AUTH_METHOD 에 따라 갈린다:
//     - magiclink → step "sent" : "메일함에서 링크를 클릭하세요" 안내(검증은 /auth/callback 이 담당)
//     - otp       → step "code" : 받은 6자리 코드 입력 후 verifyEmailCode → 서버가 홈으로 리다이렉트
//
// 폼 검증 라이브러리(RHF/Zod)는 후보로 보류 — 필드가 소수라 useState + Server Action 으로 충분.
type Step = "email" | "code" | "sent";

export default function LoginPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSendEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await sendEmailCode(email);
      if (res.ok) {
        // 매직링크는 코드 입력이 없으므로 "발송 완료" 안내로, OTP는 코드 입력 단계로.
        setStep(EMAIL_AUTH_METHOD === "magiclink" ? "sent" : "code");
      } else {
        setError(res.error ?? "인증 메일 발송에 실패했습니다.");
      }
    });
  }

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      // 성공 시 서버 액션 내부 redirect("/") 로 이동하므로 이 아래는 실행되지 않는다.
      const res = await verifyEmailCode(email, code);
      if (!res.ok) {
        setError(res.error ?? "코드 검증에 실패했습니다.");
      }
    });
  }

  function resetToEmail() {
    setStep("email");
    setCode("");
    setError(null);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>FitArchive 로그인</CardTitle>
          <CardDescription>
            {step === "email" &&
              (EMAIL_AUTH_METHOD === "magiclink"
                ? "이메일로 로그인 링크를 보내드립니다."
                : "이메일로 인증 코드를 보내드립니다.")}
            {step === "code" && `${email} 로 보낸 6자리 코드를 입력해 주세요.`}
            {step === "sent" && `${email} 로 로그인 링크를 보냈습니다.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "email" && (
            <form onSubmit={handleSendEmail} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isPending}
                />
              </div>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? "보내는 중…"
                  : EMAIL_AUTH_METHOD === "magiclink"
                    ? "로그인 링크 받기"
                    : "인증 코드 받기"}
              </Button>
            </form>
          )}

          {step === "code" && (
            <form onSubmit={handleVerify} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="code">인증 코드</Label>
                <Input
                  id="code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  required
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  disabled={isPending}
                />
              </div>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={isPending}>
                {isPending ? "확인 중…" : "로그인"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={isPending}
                onClick={resetToEmail}
              >
                이메일 다시 입력
              </Button>
            </form>
          )}

          {step === "sent" && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                메일함에서 <strong>로그인 링크</strong>를 클릭하면 로그인됩니다.
                이 창은 닫으셔도 됩니다.
              </p>
              <p className="text-xs text-muted-foreground">
                메일이 안 보이면 스팸함을 확인하거나, 잠시 후 다시 시도해 주세요.
              </p>
              <Button type="button" variant="ghost" onClick={resetToEmail}>
                다른 이메일로 다시 보내기
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
