"""Minimal workflow engine to remove external framework dependency."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Coroutine, Generic, TypeVar

T = TypeVar("T")
Handler = Callable[[Any, "WorkflowContext[Any]"], Coroutine[Any, Any, None]]


def handler(func: Handler) -> Handler:
    """Mark a coroutine method as a workflow handler."""

    setattr(func, "_workflow_handler", True)
    return func


class WorkflowContext(Generic[T]):
    """Minimal context that holds shared state and messages."""

    def __init__(self, shared_state: dict[str, Any], outputs: list[Any]) -> None:
        self._shared_state = shared_state
        self._outputs = outputs
        self._next_message: Any | None = None

    async def set_shared_state(self, key: str, value: Any) -> None:
        self._shared_state[key] = value

    async def get_shared_state(self, key: str) -> Any:
        return self._shared_state.get(key)

    async def send_message(self, payload: Any) -> None:
        self._next_message = payload

    async def yield_output(self, payload: Any) -> None:
        self._outputs.append(payload)

    def _consume_message(self) -> Any | None:
        message = self._next_message
        self._next_message = None
        return message


class Executor:
    """Minimal executor that holds exactly one handler."""

    def __init__(self, id: str) -> None:
        self.id = id

    def _get_handler(self) -> Handler:
        for attr in dir(self):
            candidate = getattr(self, attr)
            if callable(candidate) and getattr(candidate, "_workflow_handler", False):
                return candidate
        raise RuntimeError(f"Executor {self.id} has no handler")


@dataclass(frozen=True)
class WorkflowRunResult:
    """Compatibility wrapper that holds the workflow outputs."""

    outputs: list[Any]

    def get_outputs(self) -> list[Any]:
        return list(self.outputs)


class Workflow:
    """Minimal workflow for sequential execution."""

    def __init__(self, name: str, start: Executor, edges: dict[Executor, Executor]) -> None:
        self.name = name
        self._start = start
        self._edges = edges

    async def run(self, initial_input: Any) -> WorkflowRunResult:
        shared_state: dict[str, Any] = {}
        outputs: list[Any] = []
        ctx: WorkflowContext[Any] = WorkflowContext(shared_state, outputs)

        current = self._start
        payload: Any = initial_input

        while True:
            handler = current._get_handler()
            await handler(payload, ctx)

            next_executor = self._edges.get(current)
            if next_executor is None:
                break

            next_payload = ctx._consume_message()
            if next_payload is None:
                raise RuntimeError(
                    f"Executor {current.id} did not send a message for the next stage"
                )
            payload = next_payload
            current = next_executor

        return WorkflowRunResult(outputs=outputs)


class WorkflowBuilder:
    """Simple builder that handles only ordered edges."""

    def __init__(self, name: str) -> None:
        self.name = name
        self._start: Executor | None = None
        self._edges: dict[Executor, Executor] = {}

    def set_start_executor(self, executor: Executor) -> None:
        self._start = executor

    def add_edge(self, from_executor: Executor, to_executor: Executor) -> None:
        self._edges[from_executor] = to_executor

    def build(self) -> Workflow:
        if self._start is None:
            raise RuntimeError("Start executor is not set")
        return Workflow(self.name, self._start, self._edges)
