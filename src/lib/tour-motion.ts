// Pannellum's positive rotation decreases yaw, moving the image to the right.
export const TOUR_ROTATION_SPEED = 1.5;

export function tourMotion(reducedMotion: boolean) {
  return {
    autoRotate: reducedMotion ? false : TOUR_ROTATION_SPEED,
    autoRotateInactivityDelay: reducedMotion ? -1 : 4000,
    friction: reducedMotion ? 0.15 : 0.04,
    touchPanSpeedCoeffFactor: 0.8,
  };
}
