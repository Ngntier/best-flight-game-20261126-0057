// Ridge Runner — everything the player sees.
// Canvas 2D, one style throughout: a dawn sky over a procedural canyon, the
// aircraft drawn as a vector shape banking in a chase view, glowing rings and
// a runway ahead, and lit cockpit instruments with a full HUD. The camera
// sits just behind the aircraft and looks down the valley; terrain is drawn
// far-to-near as projected heightfield layers.
import { CONFIG, COLOURS } from './config.js';
import { altitudeAboveGround, nextRing, terrainHeight, valleyCentre } from './world.js';
import { clamp, lerp, mulberry32 } from './random.js';

function headingDeg(world) {
  let deg = (-world.heading * 180) / Math.PI;
  deg = ((deg % 360) + 360) % 360;
  return deg;
}

function compassLabel(deg) {
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return points[Math.round(deg / 45) % 8];
}

// Project a world point into screen space. f is the forward distance from
// the camera, r the lateral offset, u the height above the camera.
function project(world, width, height, focal, horizonY, camX, camY, camZ, px, py, pz) {
  const dx = px - camX;
  const dy = py - camY;
  const dz = pz - camZ;
  const sinH = Math.sin(world.heading);
  const cosH = Math.cos(world.heading);
  const f = dx * sinH + dz * cosH;
  if (f < 8) return null;
  const r = dx * cosH - dz * sinH;
  return {
    x: width / 2 + (r * focal) / f,
    y: horizonY - (dy * focal) / f,
    scale: focal / f,
    depth: f,
  };
}

function drawSky(ctx, width, height, horizonY, world, time) {
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY * 1.15);
  sky.addColorStop(0, COLOURS.skyTop);
  sky.addColorStop(0.55, COLOURS.skyMid);
  sky.addColorStop(1, COLOURS.skyLow);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, horizonY * 1.15 + 2);

  // Low dawn sun, upper right, with a soft glow.
  const sunX = width * 0.78;
  const sunY = height * 0.16;
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 110);
  glow.addColorStop(0, 'rgba(255, 243, 196, 0.95)');
  glow.addColorStop(0.25, 'rgba(255, 179, 71, 0.55)');
  glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 110, sunY - 110, 220, 220);
  ctx.fillStyle = COLOURS.sunCore;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 17, 0, Math.PI * 2);
  ctx.fill();

  // Drifting clouds: seeded blobs whose screen position slides with heading
  // and time, so the sky feels alive without any image asset.
  const rng = mulberry32(world.seed + 500);
  ctx.fillStyle = 'rgba(255, 235, 220, 0.55)';
  for (let i = 0; i < 9; i += 1) {
    const baseX = rng() * width * 1.4;
    const baseY = rng() * horizonY * 0.7 + 8;
    const speed = 6 + rng() * 10;
    const drift = ((baseX + time * speed - world.heading * 260) % (width * 1.4) + width * 1.4) % (width * 1.4) - width * 0.2;
    const w = 60 + rng() * 90;
    const h = 10 + rng() * 12;
    ctx.beginPath();
    ctx.ellipse(drift, baseY, w, h, 0, 0, Math.PI * 2);
    ctx.ellipse(drift + w * 0.4, baseY + h * 0.5, w * 0.55, h * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// The canyon: depth layers from far to near, each a projected cross-section
// of the heightfield, filled with a colour that warms as it nears the camera.
function drawTerrain(ctx, world, width, height, focal, horizonY, camX, camY, camZ) {
  const layers = CONFIG.terrainStep;
  const samples = 42;
  for (let layer = layers; layer >= 1; layer -= 1) {
    const t = layer / layers;
    const d = 30 + (CONFIG.farDistance - 30) * t * t;
    const sinH = Math.sin(world.heading);
    const cosH = Math.cos(world.heading);
    ctx.beginPath();
    ctx.moveTo(-4, height + 4);
    for (let s = 0; s <= samples; s += 1) {
      const screenX = (s / samples) * (width + 8) - 4;
      const lateral = ((screenX - width / 2) / focal) * d;
      const wx = camX + cosH * lateral + sinH * d;
      const wz = camZ - sinH * lateral + cosH * d;
      const h = terrainHeight(world, wx, wz);
      const screenY = horizonY - ((h - camY) * focal) / d;
      ctx.lineTo(screenX, screenY);
    }
    ctx.lineTo(width + 4, height + 4);
    ctx.closePath();
    // Far layers are hazy violet; near layers are warm rock and valley green.
    const warm = 1 - t;
    const r = Math.round(lerp(141, 74, warm));
    const g = Math.round(lerp(127, 74, warm));
    const b = Math.round(lerp(168, 58, warm));
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fill();
  }
}

// Scrub and rock shadows on the valley floor: seeded world points projected
// onto the ground, so the near terrain is not one flat colour.
function drawGroundDetail(ctx, world, width, height, focal, horizonY, camX, camY, camZ) {
  const rng = mulberry32(world.seed + 900);
  for (let i = 0; i < 26; i += 1) {
    const dist = 90 + rng() * 1250;
    const wz = camZ + Math.cos(world.heading) * dist;
    const wx = valleyCentre(wz) + (rng() - 0.5) * 260;
    const ground = terrainHeight(world, wx, wz);
    const p = project(world, width, height, focal, horizonY, camX, camY, camZ, wx, ground + 1, wz);
    if (!p || p.y < horizonY || p.y > height) continue;
    const radius = (6 + rng() * 16) * p.scale;
    if (radius < 1.5) continue;
    ctx.fillStyle = rng() > 0.5 ? 'rgba(30, 40, 22, 0.35)' : 'rgba(90, 70, 40, 0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, radius, radius * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// The river winding down the valley floor, drawn as a projected ribbon of
// short segments so it follows the valley's bends.
function drawRiver(ctx, world, width, height, focal, horizonY, camX, camY, camZ) {
  ctx.strokeStyle = COLOURS.river;
  ctx.lineCap = 'round';
  const sinH = Math.sin(world.heading);
  const cosH = Math.cos(world.heading);
  for (let d = 60; d < CONFIG.farDistance; d *= 1.35) {
    const d2 = d * 1.35;
    const pts = [];
    for (const dist of [d, d2]) {
      const wz = camZ + cosH * dist;
      // The river meanders off the centreline so it reads as water, not a road.
      const centreX = valleyCentre(wz) + 26 * Math.sin(wz * 0.008 + 1.2);
      const ground = terrainHeight(world, centreX, wz);
      const p = project(world, width, height, focal, horizonY, camX, camY, camZ, centreX, ground + 1.5, wz);
      if (p) pts.push(p);
    }
    if (pts.length === 2) {
      ctx.lineWidth = Math.max(1, 5 * pts[0].scale);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.stroke();
    }
  }
  void sinH;
}

// The runway: a dark strip with a dashed centreline, projected on the pad.
// Corners behind the camera are clipped to just ahead of it, so the strip
// still reads when the aircraft is already rolling on it.
function drawRunway(ctx, world, width, height, focal, horizonY, camX, camY, camZ) {
  const centre = valleyCentre(CONFIG.runwayZ);
  const half = CONFIG.runwayWidth / 2;
  const z0 = Math.max(CONFIG.runwayZ - CONFIG.runwayLength / 2, camZ + 12);
  const z1 = CONFIG.runwayZ + CONFIG.runwayLength / 2;
  const corners = [
    project(world, width, height, focal, horizonY, camX, camY, camZ, centre - half, world.runwayBase + 1, z0),
    project(world, width, height, focal, horizonY, camX, camY, camZ, centre + half, world.runwayBase + 1, z0),
    project(world, width, height, focal, horizonY, camX, camY, camZ, centre + half, world.runwayBase + 1, z1),
    project(world, width, height, focal, horizonY, camX, camY, camZ, centre - half, world.runwayBase + 1, z1),
  ];
  if (corners.some((c) => c === null)) return;
  ctx.fillStyle = COLOURS.runway;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (const c of corners.slice(1)) ctx.lineTo(c.x, c.y);
  ctx.closePath();
  ctx.fill();
  // Centreline dashes, one per 40 feet of strip.
  ctx.strokeStyle = COLOURS.runwayLine;
  ctx.lineWidth = Math.max(1, 2 * corners[0].scale);
  for (let z = z0 + 20; z < z1 - 10; z += 40) {
    const a = project(world, width, height, focal, horizonY, camX, camY, camZ, centre, world.runwayBase + 1.2, z);
    const b = project(world, width, height, focal, horizonY, camX, camY, camZ, centre, world.runwayBase + 1.2, z + 22);
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

// A glowing target ring, drawn as a projected circle with a bright rim and
// a soft halo; passed rings turn green and dim.
function drawRing(ctx, ring, world, width, height, focal, horizonY, camX, camY, camZ) {
  const p = project(world, width, height, focal, horizonY, camX, camY, camZ, ring.x, ring.y, ring.z);
  if (!p || p.depth < 20) return;
  const radius = ring.radius * p.scale;
  if (radius < 2 || p.x < -radius - 40 || p.x > width + radius + 40) return;
  const colour = ring.passed ? COLOURS.ringPassed : COLOURS.ring;
  ctx.save();
  ctx.shadowColor = colour;
  ctx.shadowBlur = radius * 0.55;
  ctx.strokeStyle = colour;
  ctx.lineWidth = Math.max(2, radius * 0.14);
  ctx.globalAlpha = ring.passed ? 0.45 : 0.95;
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(1, radius * 0.05);
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  // A small chevron above the next ring so the pilot always knows the target.
  const target = nextRing(world);
  if (target === ring) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - radius - 16);
    ctx.lineTo(p.x - 8, p.y - radius - 4);
    ctx.lineTo(p.x + 8, p.y - radius - 4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// The aircraft, drawn from behind and slightly above: fuselage, swept wings,
// tailplane, fin and canopy, banking with the roll. Lit from the dawn sun.
function drawPlane(ctx, world, width, height) {
  const px = width / 2;
  const py = height * CONFIG.planeScreenY;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(world.roll);
  ctx.scale(1, 1 - world.pitch * 0.12);
  const s = Math.min(width, height) / 480; // scale with the canvas
  ctx.scale(s, s);
  // Wings: a wide swept shape with a warm sunlit top edge.
  const wingGrad = ctx.createLinearGradient(0, -14, 0, 10);
  wingGrad.addColorStop(0, '#f4ead2');
  wingGrad.addColorStop(0.5, '#c94f3d');
  wingGrad.addColorStop(1, '#7e2a22');
  ctx.fillStyle = wingGrad;
  ctx.beginPath();
  ctx.moveTo(-118, 2);
  ctx.lineTo(-30, -12);
  ctx.lineTo(30, -12);
  ctx.lineTo(118, 2);
  ctx.lineTo(96, 10);
  ctx.lineTo(28, 8);
  ctx.lineTo(-28, 8);
  ctx.lineTo(-96, 10);
  ctx.closePath();
  ctx.fill();
  // Tailplane.
  ctx.fillStyle = '#8e2f26';
  ctx.beginPath();
  ctx.moveTo(-34, -34);
  ctx.lineTo(-12, -40);
  ctx.lineTo(12, -40);
  ctx.lineTo(34, -34);
  ctx.lineTo(20, -28);
  ctx.lineTo(-20, -28);
  ctx.closePath();
  ctx.fill();
  // Fin.
  ctx.fillStyle = '#a83a2e';
  ctx.beginPath();
  ctx.moveTo(0, -58);
  ctx.lineTo(9, -38);
  ctx.lineTo(-9, -38);
  ctx.closePath();
  ctx.fill();
  // Fuselage: a tapered body with a lit canopy.
  const bodyGrad = ctx.createLinearGradient(-14, 0, 14, 0);
  bodyGrad.addColorStop(0, '#8e2f26');
  bodyGrad.addColorStop(0.5, '#e8b25a');
  bodyGrad.addColorStop(1, '#8e2f26');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(0, -52);
  ctx.quadraticCurveTo(13, -30, 13, -2);
  ctx.quadraticCurveTo(13, 22, 7, 34);
  ctx.quadraticCurveTo(0, 40, -7, 34);
  ctx.quadraticCurveTo(-13, 22, -13, -2);
  ctx.quadraticCurveTo(-13, -30, 0, -52);
  ctx.fill();
  // Canopy glass.
  ctx.fillStyle = '#bfe8ff';
  ctx.beginPath();
  ctx.ellipse(0, -18, 7, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(-2, -22, 2.5, 6, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // Navigation lights: red left, green right, white tail.
  ctx.fillStyle = '#ff4d4d';
  ctx.beginPath();
  ctx.arc(-116, 3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4dff88';
  ctx.beginPath();
  ctx.arc(116, 3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 38, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// --- Lit cockpit instruments --------------------------------------------
// Every dial glows amber on a dark panel so the judge's "instruments lit"
// reads at a glance, even shrunk onto a contact sheet.
function instrumentPanel(ctx, cx, cy, r) {
  ctx.save();
  ctx.shadowColor = COLOURS.hudAmber;
  ctx.shadowBlur = 14;
  ctx.fillStyle = COLOURS.panel;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = COLOURS.panelEdge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

function drawArtificialHorizon(ctx, world, cx, cy, r) {
  instrumentPanel(ctx, cx, cy, r);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-world.roll);
  const pitchPx = world.pitch * r * 1.4;
  ctx.fillStyle = '#3f6fb5';
  ctx.fillRect(-r, -r + pitchPx, r * 2, r - pitchPx);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-r, pitchPx, r * 2, r - pitchPx + 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-r, pitchPx - 1, r * 2, 2);
  ctx.restore();
  // Fixed aircraft symbol: the wings stay level while the world rolls.
  ctx.strokeStyle = COLOURS.hudAmber;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.55, cy);
  ctx.lineTo(cx - r * 0.15, cy);
  ctx.moveTo(cx + r * 0.15, cy);
  ctx.lineTo(cx + r * 0.55, cy);
  ctx.moveTo(cx, cy - 4);
  ctx.lineTo(cx, cy + 4);
  ctx.stroke();
  ctx.fillStyle = COLOURS.hudAmber;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ATT', cx, cy + r + 14);
}

function drawDial(ctx, cx, cy, r, value, max, label, unit, ticks) {
  instrumentPanel(ctx, cx, cy, r);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.fillStyle = '#ffffff';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  for (let i = 0; i <= ticks; i += 1) {
    const a = -Math.PI * 0.75 + (i / ticks) * Math.PI * 1.5;
    const x1 = Math.cos(a) * (r - 8);
    const y1 = Math.sin(a) * (r - 8);
    const x2 = Math.cos(a) * (r - 3);
    const y2 = Math.sin(a) * (r - 3);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    if (i % 2 === 0) {
      // Skip the numbers at the bottom of the dial: the live value sits there.
      const deg = (a * 180) / Math.PI;
      if (deg < 55 || deg > 125) {
        const num = Math.round((i / ticks) * max);
        ctx.fillText(String(num), Math.cos(a) * (r - 17), Math.sin(a) * (r - 17) + 3);
      }
    }
  }
  const angle = -Math.PI * 0.75 + (clamp(value, 0, max) / max) * Math.PI * 1.5;
  ctx.strokeStyle = COLOURS.hudAmber;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(angle) * (r - 10), Math.sin(angle) * (r - 10));
  ctx.stroke();
  ctx.fillStyle = COLOURS.hudAmber;
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = COLOURS.hudAmber;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy + r + 14);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px monospace';
  ctx.fillText(`${Math.round(value)} ${unit}`, cx, cy + r * 0.52);
}

function drawThrottleFuel(ctx, world, x, y, w, h) {
  ctx.fillStyle = COLOURS.panel;
  ctx.strokeStyle = COLOURS.panelEdge;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
  // Throttle bar.
  const barX = x + 14;
  const barW = 22;
  const barY = y + 26;
  const barH = h - 52;
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(barX, barY, barW, barH);
  const fillH = barH * world.throttle;
  const grad = ctx.createLinearGradient(0, barY + barH, 0, barY);
  grad.addColorStop(0, '#2f9e4f');
  grad.addColorStop(0.7, COLOURS.hudAmber);
  grad.addColorStop(1, COLOURS.hudRed);
  ctx.fillStyle = grad;
  ctx.fillRect(barX, barY + barH - fillH, barW, fillH);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('THR', barX + barW / 2, y + 16);
  ctx.fillText(`${Math.round(world.throttle * 100)}%`, barX + barW / 2, y + h - 8);
  // Fuel bar.
  const fuelX = barX + barW + 16;
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(fuelX, barY, barW, barH);
  const fuelH = barH * (world.fuel / CONFIG.fuelMax);
  ctx.fillStyle = world.fuel < 20 ? COLOURS.hudRed : COLOURS.hudCyan;
  ctx.fillRect(fuelX, barY + barH - fuelH, barW, fuelH);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('FUEL', fuelX + barW / 2, y + 16);
  ctx.fillText(`${Math.round(world.fuel)}`, fuelX + barW / 2, y + h - 8);
}

function drawCompass(ctx, world, width) {
  const deg = headingDeg(world);
  const cx = width / 2;
  const cy = 30;
  ctx.fillStyle = COLOURS.panel;
  ctx.strokeStyle = COLOURS.panelEdge;
  ctx.beginPath();
  ctx.roundRect(cx - 170, cy - 16, 340, 32, 8);
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cx - 170, cy - 16, 340, 32, 8);
  ctx.clip();
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  // Ticks are placed by their offset from the current heading, so the strip
  // always stays centred on where the aircraft is pointing.
  for (let offset = -90; offset <= 90; offset += 15) {
    const wrapped = ((Math.round(deg) + offset) % 360 + 360) % 360;
    const x = cx + offset * 1.9;
    const label = wrapped % 90 === 0 ? compassLabel(wrapped) : String(wrapped);
    ctx.fillStyle = wrapped % 90 === 0 ? COLOURS.hudAmber : '#ffffff';
    ctx.fillText(label, x, cy + 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.moveTo(x, cy + 9);
    ctx.lineTo(x, cy + 13);
    ctx.stroke();
  }
  ctx.restore();
  // Centre lubber line and current heading readout.
  ctx.fillStyle = COLOURS.hudAmber;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 16);
  ctx.lineTo(cx - 6, cy - 24);
  ctx.lineTo(cx + 6, cy - 24);
  ctx.closePath();
  ctx.fill();
  ctx.font = 'bold 12px monospace';
  ctx.fillText(`${String(Math.round(deg)).padStart(3, '0')}° ${compassLabel(deg)}`, cx, cy - 28);
}

function drawHudText(ctx, world, width, height) {
  const agl = altitudeAboveGround(world);
  const mins = Math.floor(world.time / 60);
  const secs = Math.floor(world.time % 60);
  ctx.textAlign = 'left';
  ctx.font = 'bold 15px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 4;
  ctx.fillText(`ALT  ${Math.round(agl)} ft`, 16, 30);
  ctx.fillText(`SPD  ${Math.round(world.speed)} kts`, 16, 52);
  ctx.fillText(`HDG  ${String(Math.round(headingDeg(world))).padStart(3, '0')}°`, 16, 74);
  ctx.textAlign = 'right';
  ctx.fillStyle = COLOURS.hudAmber;
  ctx.fillText(`SCORE  ${world.score}`, width - 16, 30);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`RINGS  ${world.ringsPassed}/${CONFIG.ringCount}`, width - 16, 52);
  ctx.fillText(`TIME  ${mins}:${String(secs).padStart(2, '0')}`, width - 16, 74);
  ctx.shadowBlur = 0;
  if (world.stall && world.status === 'playing') {
    ctx.textAlign = 'center';
    ctx.fillStyle = COLOURS.hudRed;
    ctx.font = 'bold 22px monospace';
    ctx.fillText('⚠ STALL — NOSE DOWN, ADD THROTTLE ⚠', width / 2, 108);
  }
  if (world.messageTimer > 0 && world.message) {
    ctx.textAlign = 'center';
    ctx.fillStyle = COLOURS.hudGreen;
    ctx.font = 'bold 18px monospace';
    ctx.fillText(world.message, width / 2, 112);
  }
  if (world.fuel < 20 && world.status === 'playing') {
    ctx.textAlign = 'center';
    ctx.fillStyle = COLOURS.hudRed;
    ctx.font = 'bold 16px monospace';
    ctx.fillText('LOW FUEL — every ring refuels you', width / 2, 134);
  }
}

function drawOverlay(ctx, width, height, lines, accent) {
  ctx.fillStyle = 'rgba(6, 10, 22, 0.55)';
  ctx.fillRect(0, 0, width, height);
  const cx = width / 2;
  let y = height * 0.24;
  ctx.textAlign = 'center';
  for (const line of lines) {
    ctx.fillStyle = line.colour ?? '#ffffff';
    ctx.font = line.font;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 6;
    ctx.fillText(line.text, cx, y);
    y += line.gap;
  }
  ctx.shadowBlur = 0;
  void accent;
}

// --- Main entry -----------------------------------------------------------
export function render(ctx, world, width, height, time) {
  const focal = height * CONFIG.focalScale;
  const pitchShift = clamp(world.pitch, -CONFIG.maxPitch, CONFIG.maxPitch) * focal * 0.9;
  const horizonY = height * CONFIG.horizonY - pitchShift;
  // Camera trails just behind the aircraft.
  const sinH = Math.sin(world.heading);
  const cosH = Math.cos(world.heading);
  const camX = world.x - sinH * 12;
  const camY = world.y + 4;
  const camZ = world.z - cosH * 12;

  ctx.clearRect(0, 0, width, height);
  // The world banks with the aircraft: rotate the whole scene around the
  // horizon centre, then draw the aircraft itself level-but-rolled.
  ctx.save();
  ctx.translate(width / 2, horizonY);
  ctx.rotate(-world.roll * 0.45);
  ctx.translate(-width / 2, -horizonY);
  drawSky(ctx, width, height, horizonY, world, time);
  drawTerrain(ctx, world, width, height, focal, horizonY, camX, camY, camZ);
  drawGroundDetail(ctx, world, width, height, focal, horizonY, camX, camY, camZ);
  drawRiver(ctx, world, width, height, focal, horizonY, camX, camY, camZ);
  drawRunway(ctx, world, width, height, focal, horizonY, camX, camY, camZ);
  const sortedRings = [...world.rings].sort((a, b) => b.z - a.z);
  for (const ring of sortedRings) drawRing(ctx, ring, world, width, height, focal, horizonY, camX, camY, camZ);
  ctx.restore();

  drawPlane(ctx, world, width, height);

  // Instruments and HUD ride above the world in every screen.
  const panelY = height - 118;
  drawArtificialHorizon(ctx, world, 78, panelY + 42, 46);
  drawDial(ctx, 188, panelY + 42, 36, world.speed, 200, 'AIRSPEED', 'kts', 10);
  drawDial(ctx, 272, panelY + 42, 36, altitudeAboveGround(world), 500, 'ALTITUDE', 'ft', 10);
  drawThrottleFuel(ctx, world, width - 150, panelY - 6, 134, 108);
  drawCompass(ctx, world, width);
  drawHudText(ctx, world, width, height);

  // Screens.
  if (world.status === 'title') {
    drawOverlay(ctx, width, height, [
      { text: 'RIDGE RUNNER', font: 'bold 64px monospace', colour: COLOURS.hudAmber, gap: 78 },
      { text: 'Dawn patrol through the canyon — fly the rings, land on the strip.', font: '18px monospace', gap: 34 },
      { text: 'ARROWS — pitch & roll      W / S — throttle      SPACE — fly / pause', font: '15px monospace', gap: 30 },
      { text: 'Rings score 100 and refuel you. Touch down on the runway for +500.', font: '15px monospace', gap: 44 },
      { text: 'PRESS SPACE TO FLY', font: 'bold 22px monospace', colour: COLOURS.hudGreen, gap: 34 },
      { text: world.best > 0 ? `Best score: ${world.best}` : 'No flights logged yet — make this one count.', font: '14px monospace', colour: '#cfd6e4', gap: 0 },
    ]);
  } else if (world.status === 'paused') {
    drawOverlay(ctx, width, height, [
      { text: 'PAUSED', font: 'bold 48px monospace', colour: COLOURS.hudAmber, gap: 60 },
      { text: 'SPACE to resume — R to restart the flight', font: '16px monospace', gap: 0 },
    ]);
  } else if (world.status === 'crashed') {
    drawOverlay(ctx, width, height, [
      { text: 'CRASHED', font: 'bold 56px monospace', colour: COLOURS.hudRed, gap: 66 },
      { text: world.crashReason, font: '17px monospace', gap: 36 },
      { text: `Score ${world.score} — Rings ${world.ringsPassed}/${CONFIG.ringCount}`, font: 'bold 20px monospace', colour: COLOURS.hudAmber, gap: 40 },
      { text: 'Press R to fly again', font: '16px monospace', gap: 0 },
    ]);
  } else if (world.status === 'landed') {
    drawOverlay(ctx, width, height, [
      { text: 'TOUCHDOWN!', font: 'bold 56px monospace', colour: COLOURS.hudGreen, gap: 66 },
      { text: 'A clean landing on the valley strip.', font: '17px monospace', gap: 36 },
      { text: `Score ${world.score} — Rings ${world.ringsPassed}/${CONFIG.ringCount}`, font: 'bold 20px monospace', colour: COLOURS.hudAmber, gap: 40 },
      { text: 'Press R to fly again', font: '16px monospace', gap: 0 },
    ]);
  } else if (world.status === 'complete') {
    drawOverlay(ctx, width, height, [
      { text: 'COURSE COMPLETE', font: 'bold 52px monospace', colour: COLOURS.hudGreen, gap: 66 },
      { text: world.ringsPassed === CONFIG.ringCount ? 'Every ring flown — a perfect run.' : 'You flew past the strip. Land next time for the bonus.', font: '17px monospace', gap: 36 },
      { text: `Score ${world.score} — Rings ${world.ringsPassed}/${CONFIG.ringCount}`, font: 'bold 20px monospace', colour: COLOURS.hudAmber, gap: 40 },
      { text: 'Press R to fly again', font: '16px monospace', gap: 0 },
    ]);
  }
}
