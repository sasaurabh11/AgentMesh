import tiktoken

# Prices are USD per 1 000 tokens (input / output)
MODEL_PRICING_USD_PER_1K: dict[str, dict[str, float]] = {
    # OpenAI
    "gpt-4o": {"input": 0.005, "output": 0.015},
    "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
    # Anthropic Claude
    "claude-opus-4-7": {"input": 0.015, "output": 0.075},
    "claude-sonnet-4-6": {"input": 0.003, "output": 0.015},
    "claude-haiku-4-5": {"input": 0.0008, "output": 0.004},
}

# All Gemini / Gemma models are free via Google AI Studio (free tier)
_FREE_PREFIXES = ("gemini-", "gemma-")


def count_tokens(text: str, model: str = "gpt-4o-mini") -> int:
    try:
        enc = tiktoken.encoding_for_model(model if model.startswith("gpt") else "gpt-4o-mini")
    except Exception:
        enc = tiktoken.get_encoding("cl100k_base")
    return len(enc.encode(text or ""))


def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    if any(model.startswith(p) for p in _FREE_PREFIXES):
        return 0.0
    pricing = MODEL_PRICING_USD_PER_1K.get(model, MODEL_PRICING_USD_PER_1K["gpt-4o-mini"])
    return round(
        (input_tokens / 1000 * pricing["input"]) + (output_tokens / 1000 * pricing["output"]), 8
    )
