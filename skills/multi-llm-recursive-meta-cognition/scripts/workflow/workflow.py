"""Reflection-pattern workflow - sequential execution: decompose -> solve -> verify -> integrate -> reflect."""

from .engine import WorkflowBuilder, Executor, WorkflowContext, handler

from .config import AgentConfig
from .types import PromptPayload
from .decomposer import DecomposerExecutor
from .solver import SolverExecutor
from .verifier import VerifierExecutor
from .integrator import IntegratorExecutor
from .reflector import ReflectorExecutor


class PromptIngress(Executor):
    """Entry point that receives the user prompt and starts the reflection flow."""

    def __init__(self):
        super().__init__(id="prompt_ingress")

    @handler
    async def handle_string(self, prompt: str, ctx: WorkflowContext[PromptPayload]) -> None:
        payload = PromptPayload(text=prompt)
        await ctx.send_message(payload)


def build_reflection_workflow(
    decomposer_config: AgentConfig,
    solver_config: AgentConfig,
    verifier_config: AgentConfig,
    integrator_config: AgentConfig,
    reflector_config: AgentConfig,
    name: str = "multi_llm_reflection",
):
    """
    Build the reflection-pattern workflow.

    Flow:
        [User prompt]
              |
              v
        [Decomposer] - decompose the problem
              |
              v
        [Solver] - solve the subtasks
              |
              v
        [Verifier] - verify the proposed solution and self-correct
              |
              v
        [Integrator] - create the integrated draft answer
              |
              v
        [Reflector] - add reflections and a confidence score for the final answer
              |
              v
        [ReflectionResult]
    """
    builder = WorkflowBuilder(name=name)

    ingress = PromptIngress()
    decomposer = DecomposerExecutor(decomposer_config)
    solver = SolverExecutor(solver_config)
    verifier = VerifierExecutor(verifier_config)
    integrator = IntegratorExecutor(integrator_config)
    reflector = ReflectorExecutor(reflector_config)

    builder.set_start_executor(ingress)
    builder.add_edge(ingress, decomposer)
    builder.add_edge(decomposer, solver)
    builder.add_edge(solver, verifier)
    builder.add_edge(verifier, integrator)
    builder.add_edge(integrator, reflector)

    return builder.build()
