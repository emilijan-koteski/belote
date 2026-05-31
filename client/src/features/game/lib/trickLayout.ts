export type Compass = 0 | 1 | 2 | 3;

export function compassOffset(seat: number, myPlayerSeat: number): Compass {
  return ((((seat - myPlayerSeat) % 4) + 4) % 4) as Compass;
}

// Tight diamond layout matching the design's 280x240 trick area. Each slot is
// anchored at the container center via translate(-50%, -50%); offsetX/offsetY
// shifts the card outward toward the player who threw it. Rotation is a small
// jitter so cards don't land at perfect angles.
export interface SlotPosition {
  offsetX: number;
  offsetY: number;
  rotation: number;
}

export const SLOT_POSITIONS: Record<Compass, SlotPosition> = {
  // South — self.
  0: { offsetX: 0, offsetY: 60, rotation: -3 },
  // East — opponent on the right.
  1: { offsetX: 74, offsetY: 0, rotation: 8 },
  // North — partner.
  2: { offsetX: 0, offsetY: -60, rotation: 4 },
  // West — opponent on the left.
  3: { offsetX: -74, offsetY: 0, rotation: -8 },
};
