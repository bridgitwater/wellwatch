import { describe, expect, it } from "vitest";
import { stageBlurb, stageLabel } from "./stages";

describe("stage labels by project type", () => {
  it("never talks about drilling on a piped scheme", () => {
    expect(stageLabel("drilling", "piped_scheme")).toBe("Intake & pipeline");
    expect(stageLabel("pump_apron", "piped_scheme")).toBe("Tank & taps");
    expect(stageBlurb("drilling", "piped_scheme")).not.toMatch(/drill|rig/i);
  });
  it("keeps the pump, tank & taps label for solar systems", () => {
    expect(stageLabel("pump_apron", "solar_system")).toBe("Pump, tank & taps");
    expect(stageLabel("drilling", "solar_system")).toBe("Drilling");
  });
  it("leaves drilled wells unchanged", () => {
    expect(stageLabel("drilling")).toBe("Drilling");
  });
});
