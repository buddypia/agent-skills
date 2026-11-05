# Target Surface Detection Contract

> **Role**: canonical source for target-surface detection (`target` / `viewport` / `lang`) and the rendering contract per target.
> `README.md` and `SKILL.md` defer to this document for TARGET-phase rules.

HTML is only the delivery container. The artifact must represent the product's
primary surface: mobile app, web app, desktop app, document/report, or diagram.

## Accepted flags

- `--target=auto|mobile-app|tablet-app|web-app|desktop-app|document|diagram`
- `--viewport=auto|phone|tablet|desktop`
- `--preview-mode=app|explainer|comparison`
- `--lang=auto|ko|ja|en`

Generated files should support matching URL query parameters when the output has
multiple visual modes:

- `?viewport=phone|tablet|desktop`
- `?mode=app|explainer|comparison`

## Language handling

- Mirror the user's prompt language for assistant-facing explanations.
- If the repository guidance declares a product language, use that language for generated UI labels and preview copy.
- Trip Jarvis is the name of a user project where this skill is frequently used; its product language is Korean, so generated UI labels default to Korean there.
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

- Default artifact viewport: `phone`.
- The first visual signal must be an app screen, not a web hero.
- Include safe-area, app bar/header, bottom navigation/input/composer when relevant.
- Explanation belongs in surrounding copy or `explainer` mode; the app preview itself should stay app-shaped.
- Use `.ha-device` / `type: "device"` when using the deterministic builder.
- A **whole-app-flow** request ("앱 전체 흐름", "화면 흐름", "user flow", "画面遷移") must render
  every screen as a phone-framed wireframe with labeled transition arrows - use the
  `screen-flow` module / `type: "screenflow"` builder section (its root carries
  `data-device-frame`, satisfying this contract). A generic-rectangle flowchart does not
  satisfy a mobile-app flow request.

### tablet-app

- Default viewport: `tablet`.
- Preserve app chrome and touch-sized controls; avoid desktop dashboard density.

### web-app

- Default viewport: `desktop`, with responsive behavior available.
- It is acceptable for the first viewport to be browser/dashboard shaped.
- A whole-app-flow request for a web app should render screens as browser/window
  wireframes, not phone frames. Use the `screen-flow` module with `frame: "browser"`
  or rely on top-level `target: "web-app"` so the deterministic builder selects
  browser chrome.

### desktop-app

- Use a desktop window frame, sidebar/menu bar patterns, and keyboard-oriented density.

### document/report

- Use readable document layout. Device frames are not required.

### diagram

- Prefer full-width diagram canvas. Device frames are not required unless the diagram is
  specifically about an app screen flow - in that case use the `screen-flow` module
  (`type: "screenflow"`) and choose the frame by product surface: phone/tablet for
  mobile apps, browser/window for web apps.

## Validation checklist

- The default viewport matches the detected target.
- A mobile app project does not open first as a generic web page.
- Generated controls use the same vocabulary across skills.
- Deterministic builds with `target: "mobile-app"` include an app/device frame.
