# Claude Code 개발 가이드

> 공통 규칙(Agent Delegation, 커밋 정책, Context DB 등)은 글로벌 설정(`~/.claude/CLAUDE.md`)을 따릅니다.
> 글로벌 미설치 시: `curl -fsSL https://raw.githubusercontent.com/leonardo204/dotclaude/main/install.sh | bash`

---

## Slim 정책

이 파일은 **100줄 이하**를 유지한다. 새 지침 추가 시:
1. 매 턴 참조 필요 → 이 파일에 1줄 추가
2. 상세/예시/테이블 → ref-docs/*.md에 작성 후 여기서 참조
3. ref-docs 헤더: `# 제목 — 한 줄 설명` (모델이 첫 줄만 보고 필요 여부 판단)

---

## PROJECT

### 개요

**FitArchive** — 내가 구매한 의류를 기록해, 다음 구매 때 사이즈와 이력을 쉽게 참고하는 개인 아카이브.

| 항목 | 값 |
|------|-----|
| 플랫폼 | 반응형 웹앱(PWA) — 폰·PC 브라우저 |
| 언어 | TypeScript — 타입 안정성으로 유지보수성 확보 |
| 프레임워크 | Next.js (App Router) |
| UI | Tailwind CSS + shadcn/ui |
| 데이터 | Supabase — Postgres(기록) · Storage(사진) · Auth(로그인) |
| 폼/검증 | 후보: React Hook Form + Zod (Next.js Server Action으로 충분할 수 있어 개발하며 결정) |
| 배포 | Vercel |
| 빌드 방법 | TBD — 프로젝트 scaffold 후 기입 |
| 상태 | 설계 · V1(수동 입력 코어) 준비 중 |

### 데이터 모델 (V1)

- **items** — 제품명 · 브랜드 · 카테고리 · 색상 · 사이즈라벨 · **착용느낌(딱맞음/작음/큼)** · 구매일 · 구매처 · 링크 · 가격 · 메모
- **measurements** — 실측 치수(어깨/가슴/총장 등, 카테고리별 유연)
- **photos** — item별 사진(Storage 경로 — 기록과 사진을 분리 저장)

> 핵심: 사이즈 라벨은 브랜드마다 다르다. **실측 + 착용느낌**이 이 앱의 가치.

### 기능 (V1)

- 기록 CRUD · 검색/필터 · 사진 첨부
- **데이터 내보내기(Export)** — 전체를 JSON/CSV로. 특정 서비스 잠금 없이 이식성·영속성 확보 *(데이터 모델이 아닌 기능)*
- AI 보조 입력(링크·사진 자동 추출)은 **V2** — AI가 초안, 사람이 최종 확정

### 문서 구조 (소유권 분리)

- **하니스 문서** (`claude/` 하위) — 🔒 dotclaude 소유. `dotclaude-update`가 덮어쓰니 **수정 금지**.
- **프로젝트 스펙** (`specs/` 하위) — 📝 자유롭게 작성. → [SDD 가이드라인](ref-docs/claude/sdd.md) · `/spec-guard`로 정합성 분석

### 하니스 상세 문서 (claude/)

- [Context DB](ref-docs/claude/context-db.md) — SQLite 기반 세션/태스크/결정 저장소
- [Context Monitor](ref-docs/claude/context-monitor.md) — HUD + compaction 감지/복구
- [Hooks](ref-docs/claude/hooks.md) — 5개 자동 실행 Hook 상세
- [컨벤션](ref-docs/claude/conventions.md) — 커밋, 주석, 로깅 규칙
- [셋업](ref-docs/claude/setup.md) — 새 환경 초기 설정
- [Agent Delegation](ref-docs/claude/agent-delegation.md) — 에이전트 위임/파이프라인 상세
- [SDD 가이드라인](ref-docs/claude/sdd.md) — 스펙 문서 작성/관리 규약

> 프로젝트 스펙은 `specs/`에 작성하고, 하니스 문서(`claude/`)는 건드리지 마세요.

### 핵심 규칙

- **AI는 보조, 사람이 최종 확정** — 자동 추출값도 사용자가 확인 후 저장
- **데이터 이식성 우선** — 언제든 내보내기 가능하게, 특정 서비스 잠금 회피
- **얇은 수직 슬라이스** — 항상 '돌아가는 앱'을 유지하며 확장
- **실측 + 착용느낌 기록** — 사이즈 라벨만으론 다음 구매에 도움이 안 됨
- **아키텍처 결정은 ADR로** — `ref-docs/specs/design/adr-*.md` (SDD 규약 준수, `/spec-guard`로 정합성 점검)

---

*최종 업데이트: 2026-07-22*
