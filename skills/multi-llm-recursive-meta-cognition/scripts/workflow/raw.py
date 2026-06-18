"""Helpers for capturing and serializing sanitized raw LLM data."""

from __future__ import annotations

import dataclasses
from typing import Any


def to_jsonable(value: Any, *, max_depth: int = 6, max_items: int = 100) -> Any:
    """Best-effort conversion into JSON-serializable Python types.

    Intentionally conservative to avoid huge or non-serializable objects.
    """

    if max_depth < 0:
        return "<max_depth_exceeded>"

    if value is None or isinstance(value, (str, int, float, bool)):
        return value

    if isinstance(value, dict):
        out: dict[str, Any] = {}
        for idx, (k, v) in enumerate(value.items()):
            if idx >= max_items:
                out["..."] = f"<{len(value) - max_items} more items>"
                break
            out[str(k)] = to_jsonable(v, max_depth=max_depth - 1, max_items=max_items)
        return out

    if isinstance(value, (list, tuple, set)):
        seq = list(value)
        out_list: list[Any] = []
        for idx, item in enumerate(seq):
            if idx >= max_items:
                out_list.append(f"<{len(seq) - max_items} more items>")
                break
            out_list.append(to_jsonable(item, max_depth=max_depth - 1, max_items=max_items))
        return out_list

    if dataclasses.is_dataclass(value):
        return to_jsonable(dataclasses.asdict(value), max_depth=max_depth - 1, max_items=max_items)

    model_dump = getattr(value, "model_dump", None)
    if callable(model_dump):
        try:
            return to_jsonable(model_dump(mode="json"), max_depth=max_depth - 1, max_items=max_items)
        except TypeError:
            try:
                return to_jsonable(model_dump(), max_depth=max_depth - 1, max_items=max_items)
            except Exception:
                pass

    to_dict = getattr(value, "to_dict", None)
    if callable(to_dict):
        try:
            return to_jsonable(to_dict(), max_depth=max_depth - 1, max_items=max_items)
        except Exception:
            pass

    return repr(value)


def extract_response_meta(response: Any) -> dict[str, Any]:
    """Extract lightweight metadata from an SDK response object (best-effort)."""

    if response is None:
        return {}

    meta: dict[str, Any] = {}

    for attr in ("id", "model", "created", "stop_reason", "finish_reason"):
        value = getattr(response, attr, None)
        if value is not None:
            meta[attr] = to_jsonable(value)

    usage = getattr(response, "usage", None)
    if usage is not None:
        meta["usage"] = to_jsonable(usage)

    usage_metadata = getattr(response, "usage_metadata", None)
    if usage_metadata is not None:
        meta["usage_metadata"] = to_jsonable(usage_metadata)

    return meta

