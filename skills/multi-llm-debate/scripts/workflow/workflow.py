"""Debate pattern workflow - sequential execution: Proponent -> Opponent -> Moderator."""

from .engine import WorkflowBuilder, Executor, WorkflowContext, handler

from .config import AgentConfig
from .types import PromptPayload, DebateResult
from .proponent import ProponentExecutor
from .opponent import OpponentExecutor
from .moderator import ModeratorExecutor


class PromptIngress(Executor):
    """Entry point that receives the user's debate topic and starts the debate flow."""

    def __init__(self):
        super().__init__(id="prompt_ingress")

    @handler
    async def handle_string(self, topic: str, ctx: WorkflowContext[PromptPayload]) -> None:
        payload = PromptPayload(text=topic)
        await ctx.send_message(payload)


def build_debate_workflow(
    proponent_config: AgentConfig,
    opponent_config: AgentConfig,
    moderator_config: AgentConfig,
    name: str = "multi_llm_debate",
):
    """
    Build the debate pattern workflow.

    Flow:
        [User's debate topic]
              |
              v
        [Proponent] - analyzes from a supportive/affirmative perspective
              |
              v
        [Opponent] - analyzes from a critical/opposing perspective
              |
              v
        [Moderator] - evaluates both sides and presents a final verdict
              |
              v
        [DebateResult]

    Args:
        proponent_config: Configuration for the Proponent agent
        opponent_config: Configuration for the Opponent agent
        moderator_config: Configuration for the Moderator agent
        name: Name of the workflow

    Returns:
        A configured workflow instance
    """
    builder = WorkflowBuilder(name=name)

    # Create executors
    ingress = PromptIngress()
    proponent = ProponentExecutor(proponent_config)
    opponent = OpponentExecutor(opponent_config)
    moderator = ModeratorExecutor(moderator_config)

    # Set up the sequential flow
    builder.set_start_executor(ingress)
    builder.add_edge(ingress, proponent)
    builder.add_edge(proponent, opponent)
    builder.add_edge(opponent, moderator)

    return builder.build()
