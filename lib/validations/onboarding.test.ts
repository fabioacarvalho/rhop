import { describe, expect, it } from "vitest";
import { onboardingEquipeInputSchema } from "./onboarding";

describe("onboardingEquipeInputSchema", () => {
  it("rejeita equipe_id ausente", () => {
    expect(onboardingEquipeInputSchema.safeParse({}).success).toBe(false);
  });

  it("rejeita equipe_id vazio ou só com espaços", () => {
    expect(
      onboardingEquipeInputSchema.safeParse({ equipe_id: "" }).success,
    ).toBe(false);
    expect(
      onboardingEquipeInputSchema.safeParse({ equipe_id: "   " }).success,
    ).toBe(false);
  });

  it("aceita string não-vazia (cuid), sem exigir formato UUID", () => {
    expect(
      onboardingEquipeInputSchema.safeParse({
        equipe_id: "cljk3x9c40000qzrmn831i7rn",
      }).success,
    ).toBe(true);
  });
});
