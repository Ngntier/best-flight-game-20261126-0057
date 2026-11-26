// Ridge Runner — staged scenes for screenshots.
// `?shot=<name>` puts the game into one frozen, deterministic frame instead
// of the loop: the same seed always paints the same picture, so the four
// screenshots are reproducible. Each scene is painted twice before the shot
// is declared ready, so fonts and the first frame have settled.
import { CONFIG } from './config.js';
import { resetFlight, valleyCentre } from './world.js';

export const SHOT_NAMES = ['start', 'play', 'ring', 'end'];

function placeOnCourse(world, ringIndex, distanceBefore) {
  const ring = world.rings[ringIndex];
  world.x = ring.x;
  world.y = ring.y;
  world.z = ring.z - distanceBefore;
  world.heading = 0;
  world.pitch = 0;
  world.roll = 0;
  world.speed = 120;
  world.throttle = 0.72;
}

// Stage one named scene on a fresh flight. Returns the world, ready to render.
export function stageShot(world, name) {
  resetFlight(world);
  world.status = 'playing';
  world.time = 12;
  if (name === 'start') {
    world.status = 'title';
    world.time = 0;
    world.x = valleyCentre(0);
    world.y = 95;
    world.z = 0;
    world.heading = 0.06;
    world.pitch = 0.02;
    world.roll = 0.08;
    world.speed = 95;
    world.throttle = 0.55;
    // No banner on the title screen: it would collide with the title text.
    world.message = '';
    world.messageTimer = 0;
  } else if (name === 'play') {
    // Mid-flight, closing on ring 3 with the valley opening ahead.
    placeOnCourse(world, 2, 190);
    world.rings[0].passed = true;
    world.rings[1].passed = true;
    world.ringsPassed = 2;
    world.score = 200;
    world.fuel = 78;
    world.message = 'Ring 3/10! +100';
    world.messageTimer = 99;
  } else if (name === 'ring') {
    // Nose-to-nose with ring 8; the runway strip is visible far down-valley.
    placeOnCourse(world, 7, 95);
    world.rings[0].passed = true;
    world.rings[1].passed = true;
    world.rings[2].passed = true;
    world.rings[3].passed = true;
    world.rings[4].passed = true;
    world.rings[5].passed = true;
    world.rings[6].passed = true;
    world.ringsPassed = 7;
    world.score = 700;
    world.fuel = 61;
    world.roll = 0.22;
    world.message = '';
    world.messageTimer = 0;
  } else if (name === 'end') {
    // Landed: parked near the start of the strip, so the runway stretches
    // ahead of the aircraft and the touchdown banner reads.
    world.status = 'landed';
    world.x = valleyCentre(CONFIG.runwayZ);
    world.y = world.runwayBase + 2;
    world.z = CONFIG.runwayZ - CONFIG.runwayLength / 2 + 60;
    world.heading = 0;
    world.pitch = 0;
    world.roll = 0;
    world.speed = 0;
    world.throttle = 0;
    world.fuel = 44;
    world.ringsPassed = 10;
    for (const ring of world.rings) ring.passed = true;
    world.score = 1000 + CONFIG.landingScore + 88;
    world.crashReason = '';
    world.message = '';
    world.messageTimer = 0;
  }
  return world;
}
