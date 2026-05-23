from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class LLMRef:
    provider_id: str
    provider_type: str
    model: str
    base_url: str | None = None


@dataclass(frozen=True)
class ResolvedLLMConfig(LLMRef):
    api_key: str = ""


@dataclass(frozen=True)
class AgentTask:
    task_id: str
    session_id: str
    agent_id: str
    agent_mode: str
    instruction: str
    llm_ref: LLMRef
    messages: list[dict[str, Any]] = field(default_factory=list)
    workspace_files: list[dict[str, str]] = field(default_factory=list)


@dataclass(frozen=True)
class ChatMessage:
    role: str
    content: str
    message_type: str = "TEXT"


@dataclass(frozen=True)
class FilePatch:
    file_path: str
    patch_type: str
    new_content: str
    original_content: str | None = None


@dataclass(frozen=True)
class AgentResult:
    task_id: str
    status: str
    messages: list[ChatMessage] = field(default_factory=list)
    patches: list[FilePatch] = field(default_factory=list)
    artifacts: list[dict[str, str]] = field(default_factory=list)
    error: str | None = None
