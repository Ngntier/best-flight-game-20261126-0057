// Ridge Runner — keyboard and mouse input.
// One object holds the live control axes; the simulation reads it every fixed
// step and never touches the DOM itself. Keys are tracked by `code` so the
// layout does not depend on the keyboard language.
export function createInput() {
  return {
    keys: new Set(),
    // Mouse steering: holding the left button steers toward the pointer.
    mouseDown: false,
    mouseX: 0,
    mouseY: 0,
    // Edge-triggered actions, consumed by the main loop once each.
    pressedSpace: false,
    pressedR: false,
    pressedP: false,
  };
}

export function attachInput(input, element) {
  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    input.keys.add(event.code);
    if (event.code === 'Space') input.pressedSpace = true;
    if (event.code === 'KeyR') input.pressedR = true;
    if (event.code === 'KeyP') input.pressedP = true;
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouseDown = false;
  });
  element.addEventListener('mousedown', (event) => {
    input.mouseDown = true;
    input.mouseX = event.clientX;
    input.mouseY = event.clientY;
  });
  window.addEventListener('mousemove', (event) => {
    input.mouseX = event.clientX;
    input.mouseY = event.clientY;
  });
  window.addEventListener('mouseup', () => {
    input.mouseDown = false;
  });
}

// Read the current control axes from the live key and mouse state.
// pitch: +1 nose up, -1 nose down. roll: +1 bank right, -1 bank left.
// throttle: +1 more power, -1 less.
export function readAxes(input, canvasWidth, canvasHeight) {
  const keys = input.keys;
  let pitch = 0;
  let roll = 0;
  let throttle = 0;
  if (keys.has('ArrowUp')) pitch += 1;
  if (keys.has('ArrowDown')) pitch -= 1;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) roll -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) roll += 1;
  if (keys.has('KeyW')) throttle += 1;
  if (keys.has('KeyS')) throttle -= 1;
  if (keys.has('ShiftLeft') || keys.has('ShiftRight')) throttle += 1;
  if (keys.has('ControlLeft') || keys.has('ControlRight')) throttle -= 1;
  // Mouse: while held, the aircraft banks toward the pointer's side and
  // pitches toward its height — a gentle assist, the keyboard stays primary.
  if (input.mouseDown && canvasWidth > 0) {
    const nx = (input.mouseX / canvasWidth) * 2 - 1;
    const ny = (input.mouseY / canvasHeight) * 2 - 1;
    roll += Math.max(-1, Math.min(1, nx * 1.4));
    pitch += Math.max(-1, Math.min(1, -ny * 1.2));
  }
  return {
    pitch: Math.max(-1, Math.min(1, pitch)),
    roll: Math.max(-1, Math.min(1, roll)),
    throttle: Math.max(-1, Math.min(1, throttle)),
  };
}

export function consumePresses(input) {
  const pressed = {
    space: input.pressedSpace,
    r: input.pressedR,
    p: input.pressedP,
  };
  input.pressedSpace = false;
  input.pressedR = false;
  input.pressedP = false;
  return pressed;
}
