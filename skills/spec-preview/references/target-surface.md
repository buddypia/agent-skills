# Target Surface Detection Contract

HTML is only the delivery container. The preview must represent the product's
primary surface: mobile app, web app, desktop app, document/report, or diagram.

## Accepted flags

These flags are canonical vocabulary for user requests and detection results —
not a real CLI. Generated HTML mirrors the same vocabulary in its URL queries.

- `--target=auto|mobile-app|tablet-app|web-app|desktop-app|document|diagram`
- `--viewport=auto|phone|tablet|desktop`
- `--preview-mode=app|explainer|comparison`
  (`comparison` refers to the index.html comparison page itself; view pages
  only implement `app|explainer`.)
- `--lang=auto|ko|ja|en`

URL query parameters in generated files should mirror the same vocabulary:

- `?viewport=phone|tablet|desktop`
- `?mode=app|explainer` — `app` shows only the product surface; `explainer`
  adds the side copy (`.preview-copy`). Implemented by shared.css.
- `?embed=1` for iframe previews that show only the product surface.

## Language handling

- Mirror the user's prompt language for assistant-facing explanations.
- If the repository guidance declares a product language, use that language for generated UI labels and preview copy.
- For Trip Jarvis, `CLAUDE.md` declares Korean as the MVP language, so generated app previews default to `lang=ko` and Korean UI text.
- Keep canonical flags, file names, query params, and internal target values in English.
- Treat Korean and Japanese trigger phrases as first-class input, not as weaker hints.

## Detection priority

1. User wording wins.
   - English: "mobile app", "smartphone app", "Flutter app", "iOS/Android" -> `mobile-app`
   - Korean: "모바일 앱", "스마트폰 앱", "앱 화면", "Flutter 앱", "iOS/Android 앱" -> `mobile-app`
   - Japanese: "スマホアプリ", "モバイルアプリ", "アプリ画面", "Flutterアプリ" -> `mobile-app`
   - English: "web app", "dashboard", "landing page", "SaaS" -> `web-app`
   - Korean: "웹 앱", "웹 대시보드", "관리자 화면", "랜딩페이지", "SaaS" -> `web-app`
   - Japanese: "Webアプリ", "Webダッシュボード", "管理画面", "ランディングページ" -> `web-app`
   - English/Korean/Japanese desktop terms: "desktop", "데스크톱", "デスクトップ", "Electron", "Tauri" -> `desktop-app`
   - English/Korean/Japanese document terms: "report", "spec", "document", "memo", "리포트", "문서", "메모", "仕様", "文書", "メモ" -> `document`
   - English/Korean/Japanese diagram terms: "diagram", "architecture", "flowchart", "다이어그램", "아키텍처", "플로우차트", "図", "構成図", "フローチャート" -> `diagram`

2. Repository metadata.
   - Flutter: `pubspec.yaml`, `lib/main.dart`, `android/`, `ios/` -> `mobile-app`
   - React Native / Expo: `app.json`, `expo`, `react-native`, `android/`, `ios/` -> `mobile-app`
   - Native iOS: `.xcodeproj`, `.xcworkspace`, `Info.plist`, SwiftUI/UIKit files -> `mobile-app`
   - Native Android: `build.gradle`, `AndroidManifest.xml`, Kotlin/Java Activity files -> `mobile-app`
   - Web: `package.json` with `next`, `vite`, `react-dom`, `astro`, `sveltekit`, `src/pages`, `app/`, `public/` -> `web-app`
   - Desktop: `electron`, `tauri`, `src-tauri`, `wails`, `macos/`, `windows/`, `linux/` without mobile app markers -> `desktop-app`

3. Project guidance.
   - Read `AGENTS.md`, `CLAUDE.md`, `README.md`, design tokens, or app manifests when present.
   - A sentence like "platform: Flutter (iOS/Android)" is authoritative for `mobile-app`.
   - A sentence like "지원 언어: 한국어" or "대화·설명은 한국어" is authoritative for `lang=ko`.

4. UI code hints.
   - `Scaffold`, `AppBar`, `BottomNavigationBar`, `SafeArea`, `ChatInput` in Flutter code -> `mobile-app`
   - `BrowserRouter`, `Next.js`, `App Router`, CSS breakpoints, browser-only navigation -> `web-app`

5. Ambiguous cases.
   - If multiple surfaces exist, choose the user's requested surface.
   - If no surface is requested, choose the product's primary customer-facing surface.
   - If still unclear and the choice changes layout meaningfully, ask one concise question.
   - In a Korean prompt context, ask in Korean: "이 제안은 모바일 앱 화면 기준으로 만들까요, 웹 화면 기준으로 만들까요?"
   - In a Japanese prompt context, ask in Japanese: "この提案はスマホアプリ画面基準ですか、Web画面基準ですか？"

## Rendering rules by target

### mobile-app

- Default preview viewport: `phone`.
- Index iframe previews must use `?viewport=phone&embed=1`.
- Full views must provide viewport controls (`phone / tablet / desktop`)
  and mode controls (`app / explainer`).
- The first visual signal must be an app screen, not a web hero.
- Include safe-area, app bar/header, bottom navigation/input/composer when relevant.
- Hide explanatory copy in `embed=1`; show only the app surface.

### tablet-app

- Default preview viewport: `tablet`.
- Preserve app chrome and touch-sized controls; avoid desktop dashboard density.

### web-app

- Default preview viewport: `desktop`, with responsive behavior available.
- It is acceptable for the first viewport to be browser/dashboard shaped.

### desktop-app

- Use a desktop window frame, sidebar/menu bar patterns, and keyboard-oriented density.

### document/report

- Use readable document layout. Device frames are not required.

### diagram

- Prefer full-width diagram canvas. Device frames are not required unless the diagram is specifically about an app screen flow.

## Validation checklist

- The default viewport matches the detected target.
- A mobile app project does not open first as a generic web page.
- Explanation is separated from product surface via `explainer` mode or side copy.
- iframe previews are target-shaped, not shrunken full web pages.
- Generated controls use the same vocabulary across skills.
