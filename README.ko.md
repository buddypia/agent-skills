# agent-skills

[English](./README.md) · **한국어** · [日本語](./README.ja.md) · [中文](./README.zh.md)

buddypia가 만든, MIT 라이선스로 배포되는 작은 크로스 에이전트 **[Agent Skills](https://agentskills.io)** 모음입니다. 대부분의 스킬은 서로 다른 벤더의 LLM 2~3개(Gemini, Claude, GPT)가 서로의 결과물을 검증하고 그 위에 작업을 쌓도록 합니다. 한편, 에이전트 안에서 완결되는 단일 에이전트 절차형 스킬도 있습니다 — 즉, 중요한 문제에서 단일 모델의 단발성 답변을 넘어서는 결과를 얻습니다. 각 스킬은 개방형 `SKILL.md` 표준을 따르므로 Claude Code, OpenAI Codex, Cursor, Gemini CLI를 비롯한 호환 에이전트 전반에서 동작합니다.

## Why these skills exist

단일 LLM에는 예측 가능한 맹점이 있습니다. 자신의 실수를 좀처럼 잡아내지 못하고, 학습 데이터의 편향을 물려받으며, 주어진 전제에 동조하는 경향(아첨, sycophancy)이 있습니다. *같은* 모델에게 "스스로 재확인하라"고 시키는 것은 대개 그 맹점을 반복할 뿐입니다.

멀티 LLM 스킬은 다른 접근을 취합니다 — 각 역할을 **서로 다른 벤더**의 모델에 맡깁니다. 한 모델이 안을 제시하면, 다른 연구소에서 다른 학습을 거친 모델이 그것을 비평하거나 반대 의견을 내고, 그 결과를 조율합니다. 독립적인 모델은 *상관관계가 낮은* 오류를 범하므로, 진정한 의견 차이가 메아리가 아니라 실제 문제를 드러냅니다. 목표는 단일 패스로는 충분하지 않은 의사결정과 산출물에서 더 견고한 결과를 얻는 것입니다.

## Skills

| Skill | 패턴 | 해결하는 문제 |
|---|---|---|
| [`multi-llm-debate`](./skills/multi-llm-debate) | 찬성 측 / 반대 측 / 중재자 → 결론 | 판단이 필요한 문제에서의 일방적이거나 과신에 찬 답변 |
| [`multi-llm-reflection`](./skills/multi-llm-reflection) | Generator → Critic → Refiner | 더 날카로운 외부 비평으로 개선해야 할 초안 |
| [`multi-llm-recursive-meta-cognition`](./skills/multi-llm-recursive-meta-cognition) | Decompose → Solve → Verify → Integrate → Reflect | 한 번의 추론으로는 너무 얕은, 어려운 다단계 문제 |
| [`reflect`](./skills/reflect) | Trigger → 5 Whys → Placement → Cure + Prevent → Ledger | 수정이 잘못된 계층에 들어가 반복되는 버그와 니어미스 |

> `multi-llm-*` 스킬은 사용자가 직접 설치하는 벤더 CLI(`agy` / Antigravity, `claude` / Claude Code, `codex` / Codex)를 오케스트레이션합니다. `reflect` 같은 단일 에이전트 스킬은 외부 CLI가 필요 없습니다. 설정 방법, 모델 오버라이드, 오프라인 `mock` 모드는 각 스킬의 README를 참고하세요.

## Use cases

- **multi-llm-debate** — 아키텍처 및 기술 스택 선택, 자체 구축 대 구매(build vs buy), 리스크 평가, "이걸 출시해야 할까?" 같은 판단 — 단일 모델의 편향이 결정하게 두고 싶지 않은 트레이드오프 검토에 적합합니다.
- **multi-llm-reflection** — 중요도가 높은 글쓰기와 설계 개선: 제안서, RFC, 문서, 마케팅 문구, 또는 *그것을 작성한 모델이 아닌* 다른 모델에게 비평받고 싶은 분석.
- **multi-llm-recursive-meta-cognition** — 복잡한 다단계 추론: 마이그레이션 계획, 디버깅 전략, 연구성 질문 — 분해, 독립적 검증, 최종 메타 리뷰가 도움이 되는 모든 문제.
- **reflect** — 버그·니어미스·반복되는 마찰 이후의 포스트모템과 근본 원인 분석: 임시방편으로 재발시키는 대신, 인시던트를 올바른 통제 계층의 수정과 문서화된 원장(ledger)으로 정리한다.

## When to use it (and when not)

추가되는 시간과 토큰을 들일 만한 가치가 있을 때 사용하세요 — 어려운 의사결정, 정확해야 하는 산출물, 까다로운 다단계 문제. 멀티 LLM 스킬은 여러 CLI를 순차적으로 실행하므로 단일 프롬프트보다 **느리고 비용도 더 듭니다**. 간단한 조회나 단순 편집에는 일반적인 단일 모델 호출이 더 나은 도구입니다. 멀티 모델 오케스트레이션은 맹점을 줄여 주지만, 정답을 **보장하지는 않으므로** 항상 출력을 검토하세요.

## Install

[`skills`](https://skills.sh) CLI를 사용합니다 (Claude Code, Codex, Cursor, Gemini CLI를 비롯한 다양한 에이전트와 함께 동작합니다):

```bash
# Browse/add skills from this repo
npx skills add buddypia/agent-skills
```

또는 스킬 폴더를 에이전트의 스킬 디렉터리에 복사하여 수동으로 설치할 수도 있습니다 — 예를 들어 `~/.claude/skills/<name>/`(Claude Code) 또는 `~/.agents/skills/<name>/`(Codex)입니다. 각 스킬은 `SKILL.md`와 자체 `README.md`를 포함하는 독립적인 디렉터리입니다(스크립트형 스킬은 `scripts/`도 함께 포함합니다).

## Requirements

`multi-llm-*` 스킬은 사용자가 본인 계정으로 직접 설치하는 공식 벤더 CLI를 구동합니다: `agy`(Antigravity), `claude`(Claude Code), `codex`(Codex). `command -v agy claude codex`로 확인하세요. Python 의존성(`pydantic` / `python-dotenv` / `pyyaml`)은 각 스킬의 `run.sh`가 자동으로 준비합니다(uv가 있으면 uv를, 없으면 venv + pip을 사용). `reflect` 같은 단일 에이전트 스킬에는 이런 것이 전혀 필요 없습니다.

## Disclaimer

이 스킬들은 사용자가 직접 설치하는 공식 CLI를 오케스트레이션할 뿐이며, 인증이나 과금을 **우회하지 않습니다**. 또한 대안으로 API 키 사용도 지원합니다. **이러한 CLI를 자동화할 때 각 제공자 및 CLI의 서비스 약관(terms of service)을 준수할 책임은 사용자 본인에게 있습니다** — 구독 인증 기반 CLI의 자동화는 사용 제한의 대상이 될 수 있으며, 계정 또는 사용에 따른 모든 결과는 사용자 본인의 책임입니다.

"Claude" / "Claude Code"(Anthropic), "GPT" / "ChatGPT" / "Codex"(OpenAI), "Gemini" / "Antigravity"(Google)는 각 소유자의 상표입니다. 본 프로젝트는 독립적인 프로젝트이며 Anthropic, OpenAI, Google과 **제휴 관계가 없고, 이들로부터 보증받거나 후원받지 않습니다.**

기본 모델 ID(예: `gemini-3.5-flash`, `claude-opus-4-8`, `gpt-5.5`)는 2026-06 기준 최신 모델을 반영하며 시간이 지남에 따라 변경됩니다. 스킬별로 오버라이드하세요. 멀티 모델 오케스트레이션은 하나의 설계상 선택일 뿐이며 **더 나은 결과를 보장하지 않습니다.** 모델 출력은 신뢰할 수 없는 것으로 간주하여 검토하고, 제3자 콘텐츠를 입력할 때는 프롬프트 인젝션(prompt-injection)에 유의하세요.

## License

MIT © 2026 buddypia. [LICENSE](./LICENSE)와 [NOTICE](./NOTICE)를 참고하세요. 각 스킬에는 자체 LICENSE와 함께, 해당 스킬에 영감을 준 연구를 명시하는 스킬별 **References & Attribution** 섹션도 포함되어 있습니다.
