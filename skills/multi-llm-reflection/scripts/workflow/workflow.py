"""Reflection pattern workflow - sequential execution: Generator -> Critic -> Refiner."""

from .engine import WorkflowBuilder, Executor, WorkflowContext, handler

from .config import AgentConfig
from .types import PromptPayload
from .generator import GeneratorExecutor
from .critic import CriticExecutor
from .refiner import RefinerExecutor


class PromptIngress(Executor):
    """Entry point that receives the user prompt and starts the reflection flow."""

    def __init__(self):
        super().__init__(id="prompt_ingress")

    @handler
    async def handle_string(self, prompt: str, ctx: WorkflowContext[PromptPayload]) -> None:
        payload = PromptPayload(text=prompt)
        await ctx.send_message(payload)


def build_reflection_workflow(
    generator_config: AgentConfig,
    critic_config: AgentConfig,
    refiner_config: AgentConfig,
    name: str = "multi_llm_reflection",
):
    """
    Build the reflection pattern workflow.

    Flow:
        [User prompt]
              |
              v
        [Generator] - creates the initial draft
              |
              v
        [Critic] - review and critique
              |
              v
        [Refiner] - creates the final refined version
              |
              v
        [ReflectionResult]
    """
    builder = WorkflowBuilder(name=name)

    ingress = PromptIngress()
    generator = GeneratorExecutor(generator_config)
    critic = CriticExecutor(critic_config)
    refiner = RefinerExecutor(refiner_config)

    builder.set_start_executor(ingress)
    builder.add_edge(ingress, generator)
    builder.add_edge(generator, critic)
    builder.add_edge(critic, refiner)

    return builder.build()
