#!/usr/bin/env bash
# worktree-review-gate :: unified Stop / SessionStart lifecycle hook
# Works across Claude Code, Codex CLI, and Antigravity (agy) — one script, three configs.
#
# Usage (event passed as $1):
#   gate.sh SessionStart   # records a per-session git baseline (HEAD + dirty snapshot)
#   gate.sh Stop           # when a linked worktree's planned work is DONE *this session*,
#                          # forces the agent to surface the approval request — once.
#
# Reads the hook JSON payload on stdin. ALWAYS prints valid JSON and exits 0:
#   - silent / allow-stop : {}
#   - force the gate       : {"decision":"block","reason":"..."}
#
# DESIGN INVARIANTS (do not weaken — each maps to a verified failure mode):
#   * FAIL-OPEN: any unexpected error prints {} and exits 0. Antigravity hooks fail CLOSED;
#     a stray non-zero exit or non-JSON output would wedge the agent. Never let that happen.
#   * READ-ONLY guard is SESSION-based, not repo-state: we fire only if THIS session changed
#     HEAD or the working tree (vs. the baseline recorded at SessionStart). Repo-state alone
#     (existing commits / a checked PLAN.md) would false-fire when merely *reading* a worktree
#     that was worked on in a previous session.
#   * IDEMPOTENCY is HEAD-scoped via a transcript sentinel, not a pre-written marker file.
#     A pre-written marker permanently suppresses the gate if the model ignores the prompt.
#   * Linked-worktree detection is canonical (absolute-git-dir != absolute git-common-dir),
#     independent of directory naming. The .worktrees/ path filter is an *additional* opt-in
#     safety filter (WTRG_WORKTREE_DIR), never an override of the canonical signal.
#
# Config knobs (env):
#   WTRG_WORKTREE_DIR  path segment that marks your worktrees. Default ".worktrees".
#                      Set to "" to fire for ANY linked worktree regardless of path.

# ---- fail-open guarantee ----------------------------------------------------
trap 'trap - EXIT; printf "{}\n" 2>/dev/null; exit 0' EXIT
finish()      { trap - EXIT; printf "%s\n" "$1" 2>/dev/null; exit 0; }
emit_silent() { finish "{}"; }
emit_block()  { finish "{\"decision\":\"block\",\"reason\":\"$1\"}"; }  # $1 MUST be JSON-safe

EVENT="${1-Stop}"   # unset (bare manual call) -> Stop; an explicit "" -> unknown -> silent
WORKTREE_DIR="${WTRG_WORKTREE_DIR-.worktrees}"

INPUT="$(cat 2>/dev/null || true)"

# ---- JSON field extraction (jq preferred; conservative fail-safe fallback) ---
json_get() { # $1 = top-level key
  # jq is top-level-only and exact. The fallback is best-effort: it returns the first
  # match anywhere (a nested same-named key could win) — but that only ever yields a
  # wrong/short path, which fails the `[ -d ]` check below and falls back to $PWD, and
  # every gate condition is independently re-derived from git. So it fails SAFE, never wrong-fires.
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$INPUT" | jq -r --arg k "$1" '.[$k] // empty' 2>/dev/null
  else
    printf '%s' "$INPUT" | tr '\n' ' ' \
      | grep -oE "\"$1\"[[:space:]]*:[[:space:]]*(\"([^\"\\\\]|\\\\.)*\"|true|false|null|-?[0-9]+)" \
      | head -n1 | sed -E "s/^\"$1\"[[:space:]]*:[[:space:]]*//; s/^\"//; s/\"$//"
  fi
}

CWD="$(json_get cwd)"; [ -z "$CWD" ] && CWD="$(json_get workspacePaths)"
[ -n "$CWD" ] && [ -d "$CWD" ] || CWD="$PWD"
cd "$CWD" 2>/dev/null || emit_silent

SESSION_ID="$(json_get session_id)"
[ -n "$SESSION_ID" ] || SESSION_ID="$(json_get sessionId)"
[ -n "$SESSION_ID" ] || SESSION_ID="$(json_get conversationId)"
[ -n "$SESSION_ID" ] || SESSION_ID="$(json_get thread_id)"

TRANSCRIPT="$(json_get transcript_path)"
[ -n "$TRANSCRIPT" ] || TRANSCRIPT="$(json_get transcriptPath)"

# ---- must be inside a git work tree -----------------------------------------
[ "$(git rev-parse --is-inside-work-tree 2>/dev/null)" = "true" ] || emit_silent

# ---- must be a LINKED worktree (canonical, naming-independent) ---------------
GD="$(git rev-parse --absolute-git-dir 2>/dev/null)" || emit_silent
COMMON="$(git rev-parse --git-common-dir 2>/dev/null)" || emit_silent
case "$COMMON" in
  /*) COMMON_ABS="$COMMON" ;;
  *)  COMMON_ABS="$(cd "$COMMON" 2>/dev/null && pwd -P)" ;;
esac
[ -n "$GD" ] && [ -n "$COMMON_ABS" ] && [ "$GD" != "$COMMON_ABS" ] || emit_silent

TOP="$(git rev-parse --show-toplevel 2>/dev/null)" || emit_silent

# ---- optional convention filter: worktree path segment (default .worktrees) --
if [ -n "$WORKTREE_DIR" ]; then
  case "/$TOP/" in *"/$WORKTREE_DIR/"*) : ;; *) emit_silent ;; esac
fi

# ---- per-worktree state dir (inside .git => invisible to `git status`) -------
STATE_DIR="$GD/review-gate"
mkdir -p "$STATE_DIR" 2>/dev/null || true
SID_SAFE="$(printf '%s' "$SESSION_ID" | tr -c 'A-Za-z0-9._-' '_')"
[ -n "$SID_SAFE" ] && [ "$SID_SAFE" != "_" ] || SID_SAFE=""
[ -n "$SID_SAFE" ] && BASE_FILE="$STATE_DIR/base-$SID_SAFE" || BASE_FILE="$STATE_DIR/base-nosession"

dirty_hash() {
  git status --porcelain 2>/dev/null | LC_ALL=C sort \
    | { sha1sum 2>/dev/null || shasum 2>/dev/null || cksum; } | awk '{print $1}'
}
write_baseline() {
  { printf 'HEAD %s\n' "$(git rev-parse HEAD 2>/dev/null)"
    printf 'DIRTY %s\n' "$(dirty_hash)"; } > "$BASE_FILE" 2>/dev/null || true
}

# ============================== SessionStart =================================
if [ "$EVENT" = "SessionStart" ]; then
  if [ -n "$SID_SAFE" ]; then
    # stable per-session id -> write once (survives resume/compaction without resetting)
    [ -f "$BASE_FILE" ] || write_baseline
  else
    # no stable id (some CLIs) -> SessionStart marks a fresh boundary, refresh the baseline
    write_baseline
  fi
  emit_silent
fi

# any event we do not understand -> stay silent (fail-open; never block a non-Stop event)
[ "$EVENT" = "Stop" ] || emit_silent

# ================================== Stop =====================================

# loop guard: our own block already forced one continuation -> allow the stop now
STOP_ACTIVE="$(json_get stop_hook_active)"
[ "$STOP_ACTIVE" = "true" ] && emit_silent

# READ-ONLY guard (session-based): require a baseline, fire only if THIS session mutated
[ -f "$BASE_FILE" ] || emit_silent
BASE_HEAD="$(sed -n 's/^HEAD //p' "$BASE_FILE" 2>/dev/null)"
BASE_DIRTY="$(sed -n 's/^DIRTY //p' "$BASE_FILE" 2>/dev/null)"
CUR_HEAD="$(git rev-parse HEAD 2>/dev/null)"
CUR_DIRTY="$(dirty_hash)"
MUTATED=0
[ -n "$CUR_HEAD" ] && [ "$CUR_HEAD" != "$BASE_HEAD" ] && MUTATED=1
[ "$CUR_DIRTY" != "$BASE_DIRTY" ] && MUTATED=1
[ "$MUTATED" -eq 1 ] || emit_silent          # read-only session -> stay silent

# PLAN.md must exist at the worktree root and be fully checked
PLAN="$TOP/PLAN.md"
[ -f "$PLAN" ] || emit_silent
DONE_RE='^[[:space:]]*[-*][[:space:]]+\[[xX]\]'
TODO_RE='^[[:space:]]*[-*][[:space:]]+\[[[:space:]]\]'
DONE_N="$(grep -E -c "$DONE_RE" "$PLAN" 2>/dev/null)"; DONE_N="$(printf '%s' "$DONE_N" | tr -cd '0-9')"; DONE_N="${DONE_N:-0}"
TODO_N="$(grep -E -c "$TODO_RE" "$PLAN" 2>/dev/null)"; TODO_N="$(printf '%s' "$TODO_N" | tr -cd '0-9')"; TODO_N="${TODO_N:-0}"
{ [ "$DONE_N" -ge 1 ] && [ "$TODO_N" -eq 0 ]; } || emit_silent

# resolve a real base branch (validate each candidate resolves to a commit)
BASE=""
for cand in "$(git rev-parse --abbrev-ref origin/HEAD 2>/dev/null)" origin/main origin/master main master; do
  [ -n "$cand" ] || continue
  case "$cand" in *'"'*|*'\'*) continue ;; esac   # refnames may legally contain " or \ ; reject so JSON output stays valid
  if git rev-parse --verify --quiet "${cand}^{commit}" >/dev/null 2>&1; then BASE="$cand"; break; fi
done
[ -n "$BASE" ] || emit_silent

SHORT="$(git rev-parse --short HEAD 2>/dev/null)"
[ -n "$SHORT" ] || emit_silent

# commits ahead of base
AHEAD="$(git rev-list --count "${BASE}..HEAD" 2>/dev/null)" || emit_silent
AHEAD="$(printf '%s' "$AHEAD" | tr -cd '0-9')"; [ -n "$AHEAD" ] || emit_silent
if [ "$AHEAD" -lt 1 ]; then
  emit_block "worktree-review-gate: PLAN.md is fully checked and this session changed the worktree, but there are no commits beyond ${BASE}. Commit your worktree work first, then surface the approval request."
fi

# idempotency: has the HEAD-scoped approval marker already been emitted this session?
# the approval request ends with:  <!-- WTRG:APPROVAL:<short-HEAD> -->
if [ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ]; then
  grep -q "WTRG:APPROVAL:$SHORT" "$TRANSCRIPT" 2>/dev/null && emit_silent
fi

# FIRE — force the agent to surface the Section 1-11 approval request before stopping.
# NOTE: the marker token below is a PLACEHOLDER (SHORTHEAD); it must NOT contain the real
# short sha, or this reason text would itself satisfy the idempotency grep above.
emit_block "worktree-review-gate: linked worktree on branch with ${AHEAD} commit(s) over ${BASE} and a fully-checked PLAN.md, changed in THIS session. Before you stop, invoke the worktree-review-gate skill and output the COMPLETE Section 1-11 approval request for human review/merge. It MUST end with the exact marker line: <!-- WTRG:APPROVAL:SHORTHEAD --> where SHORTHEAD is replaced by the output of (git rev-parse --short HEAD). Never emit this for a read-only session."
