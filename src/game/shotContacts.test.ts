import { describe, expect, it } from "vitest";
import { EMPTY_SHOT_CONTACTS, registerShotContact } from "./shotContacts";

describe("registerShotContact", () => {
  it("records an exact landing when Matter reports ground before the target sensor", () => {
    const afterGround = registerShotContact(EMPTY_SHOT_CONTACTS, "ground");
    const afterTarget = registerShotContact(afterGround, "target");

    expect(afterTarget).toEqual({
      groundContactStarted: true,
      targetContact: true,
    });
  });

  it("is independent of collision-pair order", () => {
    const groundThenTarget = registerShotContact(
      registerShotContact(EMPTY_SHOT_CONTACTS, "ground"),
      "target",
    );
    const targetThenGround = registerShotContact(
      registerShotContact(EMPTY_SHOT_CONTACTS, "target"),
      "ground",
    );

    expect(groundThenTarget).toEqual(targetThenGround);
  });
});
