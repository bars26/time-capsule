// lib/opened.ts
// Track which capsules a given wallet has opened, in localStorage.
// V2 limitation: this is per-device. A user opening a capsule on phone won't
// see it as "opened" on desktop. V3 should add an on-chain markOpened()
// function so this state lives with the capsule.

const PREFIX = "tc:opened:";

function key(userAddress: string, capsuleId: string | bigint): string {
  return `${PREFIX}${userAddress.toLowerCase()}:${capsuleId.toString()}`;
}

export function markCapsuleOpened(
  userAddress: string,
  capsuleId: string | bigint,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key(userAddress, capsuleId), "1");
  } catch {
    // localStorage may throw in private mode or with quota issues — ignore.
  }
}

export function isCapsuleOpened(
  userAddress: string,
  capsuleId: string | bigint,
): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(key(userAddress, capsuleId)) === "1";
  } catch {
    return false;
  }
}
