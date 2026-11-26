// Ridge Runner — configuration.
// One place for every tunable number: flight feel, course layout, scoring,
// rendering scale and the fixed-step loop rate. Nothing here is read from the
// network; the game is plain static files.
export const CONFIG = {
  // Canvas and camera.
  focalScale: 0.9, // focal length as a fraction of canvas height
  horizonY: 0.44, // horizon height as a fraction of canvas height
  planeScreenY: 0.62, // where the aircraft sits on screen (fraction of height)
  maxPitchShift: 0.35, // how far pitch may move the horizon (radians-ish scale)

  // Flight model.
  minSpeed: 28, // knots — below this the wing stalls
  maxSpeed: 185, // knots at full throttle, level flight
  cruiseSpeed: 95, // knots at half throttle
  throttleRate: 0.55, // throttle units per second
  pitchRate: 0.85, // radians per second of pitch authority
  rollRate: 1.9, // radians per second of roll authority
  maxPitch: 0.55, // radians nose up / down
  maxRoll: 1.15, // radians of bank
  turnRate: 0.55, // heading change per second at full bank
  climbFactor: 42, // vertical speed per unit of pitch * speed
  gravity: 9.5, // sink in ft/s when slow
  drag: 0.12, // speed decay toward the throttle target
  startAltitude: 85, // feet above the valley floor
  startSpeed: 95, // knots

  // Fuel and scoring.
  fuelMax: 100,
  fuelBurn: 0.55, // per second at full throttle
  fuelPerRing: 9, // fuel bonus for each ring flown
  ringScore: 100,
  landingScore: 500,
  courseScore: 250, // bonus for flying past the runway end with all rings

  // Course.
  ringCount: 10,
  ringRadius: 26, // feet
  firstRingZ: 450,
  ringSpacing: 330,
  runwayZ: 4300, // centre of the runway strip
  runwayLength: 320,
  runwayWidth: 36,
  courseEndZ: 4650,

  // Terrain.
  valleyHalfWidth: 95, // flat-ish valley floor half width (feet)
  wallStart: 320, // lateral distance where the canyon walls top out
  wallHeight: 150, // feet of wall above the floor
  terrainStep: 26, // depth layers drawn for the canyon
  farDistance: 1500, // farthest terrain layer (feet)

  // Timing.
  step: 1 / 60, // fixed simulation step (seconds)
  timeLimit: 420, // seconds on the clock
};

export const COLOURS = {
  skyTop: '#1c2f5e',
  skyMid: '#e8825a',
  skyLow: '#f7c489',
  sunCore: '#fff3c4',
  sunGlow: '#ffb347',
  farRidge: '#8d7fa8',
  midRidge: '#6b5f7d',
  nearRidge: '#4a4a3a',
  valleyFloor: '#5d6b46',
  river: '#7fb3d5',
  runway: '#3a3f46',
  runwayLine: '#f2e9c9',
  ring: '#39e6ff',
  ringPassed: '#7dff8a',
  hudAmber: '#ffb347',
  hudCyan: '#7fe7ff',
  hudGreen: '#8dff9a',
  hudRed: '#ff5f56',
  panel: 'rgba(8, 14, 28, 0.72)',
  panelEdge: 'rgba(255, 179, 71, 0.55)',
};
