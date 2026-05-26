"""
Unit tests for cost_tracker.py.
No database or network access required — these are pure-function tests.
"""
import pytest
from app.utils.cost_tracker import MODEL_PRICING_USD_PER_1K, calculate_cost, count_tokens


# ===========================================================================
# calculate_cost
# ===========================================================================

class TestCalculateCost:
    def test_gpt4o_cost(self):
        # 1 000 input + 1 000 output tokens
        cost = calculate_cost("gpt-4o", 1000, 1000)
        expected = 0.005 + 0.015  # $0.020
        assert cost == pytest.approx(expected, rel=1e-6)

    def test_gpt4o_mini_cost(self):
        cost = calculate_cost("gpt-4o-mini", 1000, 1000)
        expected = 0.00015 + 0.0006  # $0.00075
        assert cost == pytest.approx(expected, rel=1e-6)

    def test_claude_opus_cost(self):
        cost = calculate_cost("claude-opus-4-7", 1000, 1000)
        expected = 0.015 + 0.075  # $0.090
        assert cost == pytest.approx(expected, rel=1e-6)

    def test_claude_sonnet_cost(self):
        cost = calculate_cost("claude-sonnet-4-6", 1000, 1000)
        expected = 0.003 + 0.015  # $0.018
        assert cost == pytest.approx(expected, rel=1e-6)

    def test_claude_haiku_cost(self):
        cost = calculate_cost("claude-haiku-4-5", 1000, 1000)
        expected = 0.0008 + 0.004  # $0.0048
        assert cost == pytest.approx(expected, rel=1e-6)

    def test_gemini_flash_is_free(self):
        assert calculate_cost("gemini-2.5-flash", 100_000, 100_000) == 0.0

    def test_gemini_lite_is_free(self):
        assert calculate_cost("gemini-1.5-flash-8b", 50_000, 50_000) == 0.0

    def test_gemini_2_0_is_free(self):
        assert calculate_cost("gemini-2.0-flash", 10_000, 10_000) == 0.0

    def test_gemma_is_free(self):
        assert calculate_cost("gemma-4-31b-it", 5_000, 5_000) == 0.0

    def test_unknown_model_falls_back_to_gpt4o_mini(self):
        # Unknown models should fall back to gpt-4o-mini pricing (cheapest OpenAI)
        cost_unknown = calculate_cost("some-future-model", 1000, 1000)
        cost_mini = calculate_cost("gpt-4o-mini", 1000, 1000)
        assert cost_unknown == pytest.approx(cost_mini, rel=1e-6)

    def test_zero_tokens_returns_zero(self):
        for model in MODEL_PRICING_USD_PER_1K:
            assert calculate_cost(model, 0, 0) == 0.0

    def test_output_only_tokens(self):
        cost = calculate_cost("gpt-4o", 0, 1000)
        assert cost == pytest.approx(0.015, rel=1e-6)

    def test_input_only_tokens(self):
        cost = calculate_cost("gpt-4o", 1000, 0)
        assert cost == pytest.approx(0.005, rel=1e-6)

    def test_cost_scales_linearly(self):
        cost_1k = calculate_cost("claude-sonnet-4-6", 1000, 0)
        cost_10k = calculate_cost("claude-sonnet-4-6", 10_000, 0)
        assert cost_10k == pytest.approx(cost_1k * 10, rel=1e-6)

    def test_opus_is_most_expensive_claude(self):
        opus = calculate_cost("claude-opus-4-7", 1000, 1000)
        sonnet = calculate_cost("claude-sonnet-4-6", 1000, 1000)
        haiku = calculate_cost("claude-haiku-4-5", 1000, 1000)
        assert opus > sonnet > haiku

    def test_gpt4o_more_expensive_than_mini(self):
        assert calculate_cost("gpt-4o", 1000, 1000) > calculate_cost("gpt-4o-mini", 1000, 1000)

    def test_result_is_rounded_to_8_decimal_places(self):
        cost = calculate_cost("gpt-4o-mini", 1, 1)
        # Must not have more than 8 decimal places
        decimal_str = f"{cost:.10f}"
        decimals = decimal_str.rstrip("0").split(".")[1] if "." in decimal_str else ""
        assert len(decimals) <= 8

    def test_all_models_in_pricing_table_return_nonzero(self):
        for model in MODEL_PRICING_USD_PER_1K:
            assert calculate_cost(model, 1000, 1000) > 0.0


# ===========================================================================
# count_tokens
# ===========================================================================

class TestCountTokens:
    def test_empty_string_returns_zero(self):
        assert count_tokens("", "gpt-4o-mini") == 0

    def test_none_equivalent_handled(self):
        # The function accepts empty string as "no text"
        assert count_tokens("", "gpt-4o") == 0

    def test_short_string_returns_nonzero(self):
        assert count_tokens("Hello world", "gpt-4o-mini") > 0

    def test_longer_text_more_tokens(self):
        short = count_tokens("Hi", "gpt-4o-mini")
        long = count_tokens("Hello, this is a much longer sentence with many more tokens.", "gpt-4o-mini")
        assert long > short

    def test_gpt_model_uses_tiktoken(self):
        # gpt-4o-mini uses cl100k_base — "hello" is 1 token
        assert count_tokens("hello", "gpt-4o-mini") == 1

    def test_non_gpt_model_falls_back_to_cl100k(self):
        # Non-GPT model should still produce a valid token count
        tokens = count_tokens("hello world", "gemini-2.5-flash")
        assert tokens > 0

    def test_claude_model_falls_back_to_cl100k(self):
        tokens = count_tokens("test sentence", "claude-sonnet-4-6")
        assert tokens > 0

    def test_consistent_counts(self):
        text = "The quick brown fox jumps over the lazy dog."
        assert count_tokens(text, "gpt-4o-mini") == count_tokens(text, "gpt-4o-mini")
