import { describe, expect, it } from "vitest";
import { isCheckoutChoiceComplete } from "./paymentProvider";

describe("isCheckoutChoiceComplete", () => {
  it("accepts stripe without extra fields", () => {
    expect(isCheckoutChoiceComplete({ provider: "stripe" })).toBe(true);
  });

  it("requires a paystack currency", () => {
    expect(isCheckoutChoiceComplete({ provider: "paystack" })).toBe(false);
  });

  it("requires an explicit billing mode for NGN", () => {
    expect(isCheckoutChoiceComplete({ provider: "paystack", currency: "NGN" })).toBe(false);
    expect(
      isCheckoutChoiceComplete({ provider: "paystack", currency: "NGN", billingMode: "prepaid" }),
    ).toBe(true);
    expect(
      isCheckoutChoiceComplete({ provider: "paystack", currency: "NGN", billingMode: "subscription" }),
    ).toBe(true);
  });

  it("does not require a billing mode for non-NGN currencies", () => {
    expect(isCheckoutChoiceComplete({ provider: "paystack", currency: "GHS" })).toBe(true);
  });
});
