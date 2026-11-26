// Ridge Runner — entry point: the loop, the screens and shot mode.
// Owns the canvas, the fixed-step simulation (1/60 s), the title / play /
// paused / game-over flow, and the `?shot=` staging used for screenshots.
// The simulation lives in world.js, the drawing in render.js, the keys in
// input.js — this file only wires them together.
import { CONFIG } from './config.js';
import { createWorld, resetFlight, updateWorld } from './world.js';
import { render } from './render.js';
import { attachInput, consumePresses, createInput, readAxes } from './input.js';
import { SHOT_NAMES, stageShot } from './shots.js';

const BEST_KEY = 'ridge-runner-best-score';

function readSeed() {
  const params = new URLSearchParams(window.location.search);
  const raw = Number(params.get('seed'));
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
}

function readShot() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('shot');
  return SHOT_NAMES.includes(name) ? name : null;
}

function loadBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(score) {
  try {
    window.localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // Private mode or no storage: the game plays on without a best score.
  }
}

function fitCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  return { w, h, dpr };
}

function main() {
  const canvas = document.getElementById('game');
  const statusLine = document.getElementById('status');
  const ctx = canvas.getContext('2d');
  const world = createWorld(readSeed());
  world.best = loadBest();
  const input = createInput();
  attachInput(input, canvas);
  // Exposed for scripted play-tests: the live world and a reset helper.
  window.__ridge = { world, reset: () => resetFlight(world) };

  const shot = readShot();
  let size = fitCanvas(canvas);
  window.addEventListener('resize', () => {
    size = fitCanvas(canvas);
  });

  // Shot mode: stage the scene, paint it twice, then signal readiness.
  // No loop, no input — the frame is frozen and deterministic.
  if (shot) {
    stageShot(world, shot);
    const paint = () => {
      ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      render(ctx, world, size.w, size.h, 12);
    };
    paint();
    requestAnimationFrame(() => {
      paint();
      window.__shotReady = true;
    });
    return;
  }

  let last = performance.now();
  let accumulator = 0;
  let frames = 0;

  function frame(now) {
    const elapsed = Math.min(0.25, (now - last) / 1000);
    last = now;
    accumulator += elapsed;

    const pressed = consumePresses(input);
    if (pressed.space) {
      if (world.status === 'title') resetFlight(world);
      else if (world.status === 'playing') world.status = 'paused';
      else if (world.status === 'paused') world.status = 'playing';
      else resetFlight(world);
    }
    if (pressed.p) {
      if (world.status === 'playing') world.status = 'paused';
      else if (world.status === 'paused') world.status = 'playing';
    }
    if (pressed.r && world.status !== 'title') resetFlight(world);

    while (accumulator >= CONFIG.step) {
      const axes = readAxes(input, size.w, size.h);
      const before = world.status;
      updateWorld(world, axes, CONFIG.step);
      if (before === 'playing' && world.status !== 'playing') {
        if (world.score > world.best) {
          world.best = world.score;
          saveBest(world.best);
        }
      }
      accumulator -= CONFIG.step;
    }

    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    render(ctx, world, size.w, size.h, now / 1000);
    frames += 1;
    if (frames % 30 === 0 && statusLine) {
      statusLine.textContent =
        world.status === 'playing'
          ? `Flying — score ${world.score}, rings ${world.ringsPassed} of 10, altitude ${Math.round(world.y)} feet.`
          : `Ridge Runner — ${world.status}. Press Space to fly.`;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Entry point: wire the canvas, world and input together, then start the loop.
main();
