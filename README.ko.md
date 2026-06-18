# agent-skills

[English](./README.md) · **한국어** · [日本語](./README.ja.md) · [中文](./README.zh.md)

buddypia가 만든, MIT 라이선스로 배포되는 작은 크로스 에이전트 **[Agent Skills](https://agentskills.io)** 모음입니다. 각 스킬은 개방형 `SKILL.md` 표준을 따르므로 Claude Code, OpenAI Codex, Cursor, Gemini CLI를 비롯한 호환 에이전트 전반에서 동작합니다.

## Skills

| Skill | 기능 |
|---|---|
| [`multi-llm-debate`](./skills/multi-llm-debate) | 서로 다른 벤더의 LLM 세 개가 찬성 측 / 반대 측 / 중재자(Proponent / Opponent / Moderator) 역할로 주제를 두고 논쟁하여 다각도의 결론에 도달합니다. |
| [`multi-llm-reflection`](./skills/multi-llm-reflection) | 각 역할을 서로 다른 벤더의 LLM이 맡는 Generator → Critic → Refiner 루프입니다. |
| [`multi-llm-recursive-meta-cognition`](./skills/multi-llm-recursive-meta-cognition) | 서로 다른 벤더의 LLM에 걸쳐 진행되는 Decompose → Solve → Verify → Integrate → Reflect 파이프라인입니다. |

> 이 스킬들은 사용자가 직접 설치하는 벤더 CLI(`agy` / Antigravity, `claude` / Claude Code, `codex` / Codex)를 오케스트레이션합니다. 설정 방법, 모델 오버라이드, 오프라인 `mock` 모드는 각 스킬의 README를 참고하세요.

## Install

[`skills`](https://skills.sh) CLI를 사용합니다 (Claude Code, Codex, Cursor, Gemini CLI를 비롯한 다양한 에이전트와 함께 동작합니다):

```bash
# Browse/add skills from this repo
npx skills add buddypia/agent-skills
```

또는 스킬 폴더를 에이전트의 스킬 디렉터리에 복사하여 수동으로 설치할 수도 있습니다 — 예를 들어 `~/.claude/skills/<name>/`(Claude Code) 또는 `~/.agents/skills/<name>/`(Codex)입니다. 각 스킬은 `SKILL.md`, `scripts/`, 그리고 자체 `README.md`를 포함하는 독립적인 디렉터리입니다.

## Requirements

각 스킬은 사용자가 본인 계정으로 직접 설치하는 공식 벤더 CLI를 구동합니다: `agy`(Antigravity), `claude`(Claude Code), `codex`(Codex). `command -v agy claude codex`로 확인하세요. Python 의존성(`pydantic` / `python-dotenv` / `pyyaml`)은 각 스킬의 `run.sh`가 자동으로 준비합니다(uv가 있으면 uv를, 없으면 venv + pip을 사용).

## Disclaimer

이 스킬들은 사용자가 직접 설치하는 공식 CLI를 오케스트레이션할 뿐이며, 인증이나 과금을 **우회하지 않습니다**. 또한 대안으로 API 키 사용도 지원합니다. **이러한 CLI를 자동화할 때 각 제공자 및 CLI의 서비스 약관(terms of service)을 준수할 책임은 사용자 본인에게 있습니다** — 구독 인증 기반 CLI의 자동화는 사용 제한의 대상이 될 수 있으며, 계정 또는 사용에 따른 모든 결과는 사용자 본인의 책임입니다.

"Claude" / "Claude Code"(Anthropic), "GPT" / "ChatGPT" / "Codex"(OpenAI), "Gemini" / "Antigravity"(Google)는 각 소유자의 상표입니다. 본 프로젝트는 독립적인 프로젝트이며 Anthropic, OpenAI, Google과 **제휴 관계가 없고, 이들로부터 보증받거나 후원받지 않습니다.**

기본 모델 ID(예: `gemini-3.5-flash`, `claude-opus-4-8`, `gpt-5.5`)는 2026-06 기준 최신 모델을 반영하며 시간이 지남에 따라 변경됩니다. 스킬별로 오버라이드하세요. 멀티 모델 오케스트레이션은 하나의 설계상 선택일 뿐이며 **더 나은 결과를 보장하지 않습니다.** 모델 출력은 신뢰할 수 없는 것으로 간주하여 검토하고, 제3자 콘텐츠를 입력할 때는 프롬프트 인젝션(prompt-injection)에 유의하세요.

## License

MIT © 2026 buddypia. [LICENSE](./LICENSE)와 [NOTICE](./NOTICE)를 참고하세요. 각 스킬에는 자체 LICENSE와 함께, 해당 스킬에 영감을 준 연구를 명시하는 스킬별 **References & Attribution** 섹션도 포함되어 있습니다.
