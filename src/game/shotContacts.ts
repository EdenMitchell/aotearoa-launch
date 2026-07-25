export type ShotContactKind = "ground" | "target";

export interface ShotContacts {
  readonly groundContactStarted: boolean;
  readonly targetContact: boolean;
}

export const EMPTY_SHOT_CONTACTS: ShotContacts = {
  groundContactStarted: false,
  targetContact: false,
};

/**
 * Matter can report ground before the overlapping target sensor in one
 * collision batch. Contact accumulation must therefore be order-independent.
 */
export function registerShotContact(
  contacts: ShotContacts,
  kind: ShotContactKind,
): ShotContacts {
  return {
    groundContactStarted: contacts.groundContactStarted || kind === "ground",
    targetContact: contacts.targetContact || kind === "target",
  };
}
