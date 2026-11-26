// Ridge Runner — the flight model and the world it flies through.
// Owns the aircraft state (position, heading, pitch, roll, speed, throttle,
// fuel), the procedural canyon, the ring course, the runway, collisions and
// scoring. Pure simulation: no canvas, no DOM, no input here — the renderer
// only reads what this module computes.
import { CONFIG } from './config.js';
import { clamp, fbm2, lerp, mulberry32, smoothstep } from './random.js';

// The valley winds: its centreline drifts with two slow sines so the course
// bends left and right and the pilot has to steer, not just hold the stick.
export function valleyCentre(z) {
  return 160 * Math.sin(z * 0.0011) + 90 * Math.sin(z * 0.0023 + 1.7);
}

export function createWorld(seed) {
  const rng = mulberry32(seed);
  const world = {
    seed,
    status: 'title', // title | playing | paused | crashed | landed | complete
    time: 0,
    score: 0,
    best: 0,
    // Aircraft state. x/z are feet across/along the valley, y is feet above
    // the valley floor datum, heading 0 flies straight down the valley (+z).
    x: valleyCentre(0),
    y: CONFIG.startAltitude,
    z: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    speed: CONFIG.startSpeed,
    throttle: 0.55,
    fuel: CONFIG.fuelMax,
    ringsPassed: 0,
    message: '',
    messageTimer: 0,
    crashReason: '',
    stall: false,
    rings: [],
    runwayBase: 4,
  };
  for (let i = 0; i < CONFIG.ringCount; i += 1) {
    const z = CONFIG.firstRingZ + i * CONFIG.ringSpacing;
    const centre = valleyCentre(z);
    const lateral = (rng() - 0.5) * 110;
    const height = 58 + rng() * 42;
    world.rings.push({
      x: centre + lateral,
      y: height,
      z,
      radius: CONFIG.ringRadius,
      passed: false,
      index: i,
    });
  }
  return world;
}

// Height of the canyon at world (x, z), in feet above the datum.
// Valley floor near the centreline, steep walls rising past it, gentle
// rolling noise everywhere, and a flattened pad where the runway sits.
export function terrainHeight(world, x, z) {
  const centre = valleyCentre(z);
  const lateral = Math.abs(x - centre);
  const wall = smoothstep(CONFIG.valleyHalfWidth, CONFIG.wallStart, lateral);
  const rolling = fbm2(x * 0.012, z * 0.012, world.seed);
  const detail = fbm2(x * 0.05, z * 0.05, world.seed + 7) - 0.5;
  let height =
    wall * wall * (CONFIG.wallHeight + 80 * rolling) +
    rolling * 7 +
    detail * 4 * (1 - wall * 0.6);
  // Flatten a pad for the runway so a landing reads as a landing.
  const dz = Math.abs(z - CONFIG.runwayZ);
  const dx = Math.abs(x - valleyCentre(CONFIG.runwayZ));
  const pad = (1 - smoothstep(140, 240, dz)) * (1 - smoothstep(55, 95, dx));
  height = lerp(height, world.runwayBase, pad);
  return height;
}

export function nextRing(world) {
  return world.rings.find((ring) => !ring.passed) ?? null;
}

export function resetFlight(world) {
  world.status = 'playing';
  world.time = 0;
  world.score = 0;
  world.x = valleyCentre(0);
  world.y = CONFIG.startAltitude;
  world.z = 0;
  world.heading = 0;
  world.pitch = 0;
  world.roll = 0;
  world.speed = CONFIG.startSpeed;
  world.throttle = 0.55;
  world.fuel = CONFIG.fuelMax;
  world.ringsPassed = 0;
  world.message = 'Fly the rings — land on the runway!';
  world.messageTimer = 4;
  world.crashReason = '';
  world.stall = false;
  for (const ring of world.rings) ring.passed = false;
}

function setMessage(world, text, seconds = 3) {
  world.message = text;
  world.messageTimer = seconds;
}

// One fixed simulation step. `input` carries pitch/roll/throttle axes in
// [-1, 1] plus a pause request; the caller owns the keyboard.
export function updateWorld(world, input, dt) {
  if (world.status !== 'playing') return;
  world.time += dt;
  if (world.messageTimer > 0) world.messageTimer -= dt;

  // Throttle: W/S (or Shift/Ctrl) move it, fuel only burns while it is open.
  world.throttle = clamp(world.throttle + input.throttle * CONFIG.throttleRate * dt, 0, 1);
  if (world.fuel <= 0) world.throttle = 0;
  world.fuel = Math.max(0, world.fuel - world.throttle * CONFIG.fuelBurn * dt);

  // Pitch and roll answer the stick; roll bleeds off when the stick centres
  // so the wings level themselves, like a trainer.
  world.pitch = clamp(world.pitch + input.pitch * CONFIG.pitchRate * dt, -CONFIG.maxPitch, CONFIG.maxPitch);
  const targetRoll = input.roll * CONFIG.maxRoll;
  world.roll += (targetRoll - world.roll) * Math.min(1, dt * 4.5);
  // Banked turn: heading follows the bank — bank right, turn right.
  // Heading is measured from +z toward +x, so a positive (right) bank
  // increases the heading.
  world.heading += world.roll * CONFIG.turnRate * dt * (0.55 + world.speed / 220);

  // Speed chases the throttle setting; climbing trades speed for height.
  const targetSpeed =
    CONFIG.minSpeed + world.throttle * (CONFIG.maxSpeed - CONFIG.minSpeed);
  world.speed += (targetSpeed - world.speed) * Math.min(1, dt * CONFIG.drag * 6);
  world.speed -= Math.sin(world.pitch) * 26 * dt;
  world.speed = Math.max(12, world.speed);

  // Stall: too slow and the nose drops on its own until speed returns.
  world.stall = world.speed < 42 && world.throttle < 0.85;
  if (world.stall) world.pitch -= 0.8 * dt;

  // Move: forward along the heading, up/down with pitch and speed. Vertical
  // speed is simply the forward speed times the climb angle.
  const knotsToFeet = 1.68781;
  const forward = world.speed * knotsToFeet * dt;
  world.x += Math.sin(world.heading) * forward;
  world.z += Math.cos(world.heading) * forward;
  world.y += Math.sin(world.pitch) * world.speed * knotsToFeet * dt;
  if (world.speed < 42) world.y -= (42 - world.speed) * 0.12 * dt;
  world.y = Math.max(world.y, 2);

  // Rings: flying through one scores, refuels a little and flashes a message.
  for (const ring of world.rings) {
    if (ring.passed) continue;
    const dx = world.x - ring.x;
    const dy = world.y - ring.y;
    const dz = world.z - ring.z;
    if (Math.abs(dz) < 14 && Math.hypot(dx, dy) < ring.radius) {
      ring.passed = true;
      world.ringsPassed += 1;
      world.score += CONFIG.ringScore;
      world.fuel = Math.min(CONFIG.fuelMax, world.fuel + CONFIG.fuelPerRing);
      setMessage(world, `Ring ${world.ringsPassed}/${CONFIG.ringCount}! +${CONFIG.ringScore}`, 2.2);
    }
  }

  // Terrain: the canyon floor and walls end a flight that touches them.
  const ground = terrainHeight(world, world.x, world.z);
  const runwayCentre = valleyCentre(CONFIG.runwayZ);
  const onRunway =
    Math.abs(world.z - CONFIG.runwayZ) < CONFIG.runwayLength / 2 &&
    Math.abs(world.x - runwayCentre) < CONFIG.runwayWidth / 2;
  // Touching down on the strip is a landing at a sane speed, a crash if the
  // pilot came in far too hot. Anywhere else, the ground ends a flight.
  if (onRunway && world.y <= world.runwayBase + 4) {
    if (world.speed < 130) {
      world.status = 'landed';
      const fuelBonus = Math.round(world.fuel * 2);
      world.score += CONFIG.landingScore + fuelBonus;
      setMessage(world, `TOUCHDOWN! +${CONFIG.landingScore} landing, +${fuelBonus} fuel bonus`, 6);
    } else {
      world.status = 'crashed';
      world.crashReason = 'Came in too hot — the strip ran out under you.';
    }
    return;
  }
  if (world.y <= ground + 3) {
    world.status = 'crashed';
    world.crashReason =
      world.stall ? 'Stalled into the canyon wall.' : 'Flew into the terrain.';
    return;
  }
  if (world.z > CONFIG.courseEndZ) {
    world.status = 'complete';
    if (world.ringsPassed === CONFIG.ringCount) world.score += CONFIG.courseScore;
    return;
  }
  if (world.time > CONFIG.timeLimit) {
    world.status = 'crashed';
    world.crashReason = 'Out of time — the sun set on the valley.';
  }
}

// Altitude above the ground right below the aircraft, in feet.
export function altitudeAboveGround(world) {
  return Math.max(0, world.y - terrainHeight(world, world.x, world.z));
}
