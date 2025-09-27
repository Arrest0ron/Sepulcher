const canvas = document.getElementById('wyvern');
const ctx = canvas.getContext('2d');
let width = 0;
let height = 0;
let dpr = window.devicePixelRatio || 1;

const speedControl = document.getElementById('speedSlider');
let speedSetting = speedControl ? Number(speedControl.value) : 220;
if (speedControl) {
    speedControl.addEventListener('input', () => {
        speedSetting = Number(speedControl.value);
    });
}

const boneCursor = document.createElement('div');
boneCursor.className = 'bone-cursor';
document.body.appendChild(boneCursor);

function resize() {
    dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
}

window.addEventListener('resize', () => {
    resize();
    resetSpider();
});

resize();

const lerp = (a, b, t) => a + (b - a) * t;

const easeInOutQuad = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function projectToReach(anchorX, anchorY, targetX, targetY, minReach, maxReach) {
    let dx = targetX - anchorX;
    let dy = targetY - anchorY;
    let dist = Math.hypot(dx, dy);
    if (dist < 0.0001) {
        return {
            x: anchorX + maxReach,
            y: anchorY
        };
    }
    if (dist > maxReach) {
        const scale = maxReach / dist;
        dx *= scale;
        dy *= scale;
    } else if (dist < minReach) {
        const scale = minReach / dist;
        dx *= scale;
        dy *= scale;
    }
    return {
        x: anchorX + dx,
        y: anchorY + dy
    };
}

function createBones(lengths) {
    return lengths.map(length => ({ x: width * 0.5, y: height * 0.5, length, angle: 0 }));
}

const legSegmentLengths = [32, 48, 62];

const legBlueprints = [
    { anchorForward: 28, anchorSide: 26, restForward: 96, restSide: 126, phase: 0.0, stepForward: 26, stepSide: 16, lift: 30, swingForward: 1.35, swingSide: 1.4, reachScale: 1.08 },
    { anchorForward: 6, anchorSide: 32, restForward: 58, restSide: 140, phase: Math.PI * 0.5, stepForward: 24, stepSide: 16, lift: 34, swingForward: 1.18, swingSide: 1.25, reachScale: 1.05 },
    { anchorForward: -18, anchorSide: 30, restForward: 8, restSide: 128, phase: Math.PI, stepForward: 20, stepSide: 14, lift: 28, swingForward: 1.02, swingSide: 1.05 },
    { anchorForward: -44, anchorSide: 24, restForward: -46, restSide: 110, phase: Math.PI * 1.5, stepForward: 22, stepSide: 12, lift: 24, swingForward: 0.96, swingSide: 0.92 }
];

const mouse = { x: width * 0.5, y: height * 0.5, active: false };

window.addEventListener('pointermove', event => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    mouse.active = true;
    boneCursor.style.left = `${event.clientX}px`;
    boneCursor.style.top = `${event.clientY}px`;
    if (!boneCursor.classList.contains('active')) {
        boneCursor.classList.add('active');
    }
});

window.addEventListener('pointerleave', () => {
    mouse.active = false;
    boneCursor.classList.remove('active');
});

function solveChain(bones, tipX, tipY, anchorX, anchorY) {
    let tx = tipX;
    let ty = tipY;
    for (let i = 0; i < bones.length; i++) {
        const bone = bones[i];
        const dx = tx - bone.x;
        const dy = ty - bone.y;
        const angle = Math.atan2(dy, dx);
        bone.angle = angle;
        bone.x = tx - Math.cos(angle) * bone.length;
        bone.y = ty - Math.sin(angle) * bone.length;
        tx = bone.x;
        ty = bone.y;
    }
    const base = bones[bones.length - 1];
    const ox = anchorX - base.x;
    const oy = anchorY - base.y;
    for (let i = 0; i < bones.length; i++) {
        bones[i].x += ox;
        bones[i].y += oy;
    }
}

let thorax = { x: width * 0.5, y: height * 0.55 };
let abdomen = { x: thorax.x - 70, y: thorax.y + 14 };
let head = { x: thorax.x + 54, y: thorax.y - 6 };
let heading = { x: 1, y: 0 };
let prevThorax = { x: thorax.x, y: thorax.y };
let legs = [];

const totalLegLength = legSegmentLengths.reduce((sum, len) => sum + len, 0);

function initializeLegs() {
    legs = [];
    for (const blueprint of legBlueprints) {
        for (const side of [-1, 1]) {
            const bones = createBones(legSegmentLengths);
            legs.push({
                side,
                phase: blueprint.phase + (side > 0 ? Math.PI : 0),
                anchorForward: blueprint.anchorForward,
                anchorSide: blueprint.anchorSide,
                restForward: blueprint.restForward,
                restSide: blueprint.restSide,
                stepForward: blueprint.stepForward,
                stepSide: blueprint.stepSide,
                lift: blueprint.lift,
                swingForward: blueprint.swingForward ?? 1,
                swingSide: blueprint.swingSide ?? 1,
                reachScale: blueprint.reachScale ?? 1,
                bones,
                maxReach: totalLegLength * 0.9,
                minReach: totalLegLength * 0.36,
                foot: { x: thorax.x, y: thorax.y },
                anchor: { x: thorax.x, y: thorax.y },
                target: { x: thorax.x, y: thorax.y },
                step: null,
                stepDuration: 0.26,
                lastStepTime: -Math.abs(blueprint.phase) * 0.4
            });
        }
    }
}

function resetSpider() {
    thorax = { x: width * 0.5, y: height * 0.56 };
    abdomen = { x: thorax.x - 72, y: thorax.y + 18 };
    head = { x: thorax.x + 58, y: thorax.y - 10 };
    heading = { x: 1, y: 0 };
    prevThorax = { x: thorax.x, y: thorax.y };
    initializeLegs();
    const forwardX = heading.x;
    const forwardY = heading.y;
    const normalX = -forwardY;
    const normalY = forwardX;
    for (const leg of legs) {
        const anchorX = thorax.x + forwardX * leg.anchorForward + normalX * (leg.anchorSide * leg.side);
        const anchorY = thorax.y + forwardY * leg.anchorForward + normalY * (leg.anchorSide * leg.side);
        leg.anchor.x = anchorX;
        leg.anchor.y = anchorY;
        const footX = thorax.x + forwardX * leg.restForward + normalX * (leg.restSide * leg.side);
        const footY = thorax.y + forwardY * leg.restForward + normalY * (leg.restSide * leg.side);
        leg.foot.x = footX;
        leg.foot.y = footY;
        leg.target.x = footX;
        leg.target.y = footY;
        leg.step = null;
        leg.lastStepTime = -Math.abs(leg.phase) * 0.4;
        const restDistance = Math.hypot(footX - anchorX, footY - anchorY) || 1;
        leg.restDistance = restDistance;
        leg.minReach = Math.min(leg.minReach, restDistance * 0.7);
        const maxCap = totalLegLength * 0.95 * leg.reachScale;
        const desiredMax = restDistance * 1.02 * leg.reachScale;
        leg.maxReach = Math.min(Math.max(leg.maxReach, desiredMax), maxCap);
        solveChain(leg.bones, footX, footY, anchorX, anchorY);
    }
    mouse.x = thorax.x;
    mouse.y = thorax.y;
}

resetSpider();

let lastTime = 0;

function update(time) {
    const seconds = time * 0.001;
    const delta = Math.min((time - lastTime) / 1000 || 0, 0.03);
    lastTime = time;
    const idleX = width * 0.5 + Math.cos(seconds * 0.25) * 80;
    const idleY = height * 0.58 + Math.sin(seconds * 0.2) * 60;
    const targetX = mouse.active ? mouse.x : idleX;
    const targetY = mouse.active ? mouse.y : idleY;
    const moveDX = targetX - thorax.x;
    const moveDY = targetY - thorax.y;
    const moveDist = Math.hypot(moveDX, moveDY);
    if (moveDist > 0.0001) {
        const moveStep = Math.min(moveDist, speedSetting * delta);
        thorax.x += (moveDX / moveDist) * moveStep;
        thorax.y += (moveDY / moveDist) * moveStep;
    }

    const velX = thorax.x - prevThorax.x;
    const velY = thorax.y - prevThorax.y;
    const speed = Math.hypot(velX, velY);
    const desiredHeadingX = speed > 0.001 ? velX / speed : heading.x;
    const desiredHeadingY = speed > 0.001 ? velY / speed : heading.y;
    heading.x = lerp(heading.x, desiredHeadingX, 0.18);
    heading.y = lerp(heading.y, desiredHeadingY, 0.18);
    const mag = Math.hypot(heading.x, heading.y) || 1;
    heading.x /= mag;
    heading.y /= mag;
    const normalX = -heading.y;
    const normalY = heading.x;

    const abdomenOffset = 74;
    const abdomenSway = Math.sin(seconds * 1.3);
    const abdomenLift = Math.cos(seconds * 1.8) * 5;
    const abdomenTargetX = thorax.x - heading.x * abdomenOffset + normalX * abdomenSway * 10;
    const abdomenTargetY = thorax.y - heading.y * abdomenOffset + normalY * abdomenSway * 12 + abdomenLift;
    const abdomenFollow = Math.min(0.24 + speed * 0.9, 0.6);
    abdomen.x = lerp(abdomen.x, abdomenTargetX, abdomenFollow);
    abdomen.y = lerp(abdomen.y, abdomenTargetY, abdomenFollow);

    const abdomenDX = abdomen.x - thorax.x;
    const abdomenDY = abdomen.y - thorax.y;
    const abdomenDist = Math.hypot(abdomenDX, abdomenDY) || 1;
    const minAbdomenDist = 54;
    const maxAbdomenDist = 86;
    if (abdomenDist > maxAbdomenDist) {
        const scale = maxAbdomenDist / abdomenDist;
        abdomen.x = thorax.x + abdomenDX * scale;
        abdomen.y = thorax.y + abdomenDY * scale;
    } else if (abdomenDist < minAbdomenDist) {
        const scale = minAbdomenDist / abdomenDist;
        abdomen.x = thorax.x + abdomenDX * scale;
        abdomen.y = thorax.y + abdomenDY * scale;
    }

    const headTargetX = thorax.x + heading.x * 58 + normalX * Math.sin(seconds * 2.4) * 10;
    const headTargetY = thorax.y + heading.y * 58 + normalY * Math.sin(seconds * 2.4) * 10;
    head.x = lerp(head.x, headTargetX, 0.22 + delta * 0.4);
    head.y = lerp(head.y, headTargetY, 0.22 + delta * 0.4);

    const sway = Math.sin(seconds * 3.2) * 6;
    const bob = Math.sin(seconds * 2.1) * 10;
    const strideSpeed = 2.4 + speed * 8;
    const globalPhase = seconds * strideSpeed;
    const velocityForward = velX * heading.x + velY * heading.y;
    const sideStepping = { '-1': 0, '1': 0 };

    for (const leg of legs) {
        if (leg.step) {
            sideStepping[leg.side] += 1;
        }
    }

    for (const leg of legs) {
        const anchorX = thorax.x + heading.x * leg.anchorForward + normalX * (leg.anchorSide * leg.side) + normalX * sway * 0.35;
        const anchorY = thorax.y + heading.y * leg.anchorForward + normalY * (leg.anchorSide * leg.side) + normalY * sway * 0.35;
        leg.anchor.x = anchorX;
        leg.anchor.y = anchorY;

        const phase = globalPhase + leg.phase;
        const forwardOsc = (Math.sin(phase) * leg.stepForward * 0.35 + velocityForward * 18) * leg.swingForward;
        const lateralOsc = (Math.cos(phase) * leg.stepSide * 0.3 + sway * 0.12) * leg.swingSide;
        const desiredForward = leg.restForward + forwardOsc;
        const desiredSide = leg.restSide + lateralOsc;

        const desiredX = thorax.x + heading.x * desiredForward + normalX * (desiredSide * leg.side);
        const desiredY = thorax.y + heading.y * desiredForward + normalY * (desiredSide * leg.side) - bob * 0.1;

        const desiredProjected = projectToReach(anchorX, anchorY, desiredX, desiredY, leg.minReach, leg.maxReach);

        if (!leg.step) {
            const targetDX = desiredProjected.x - leg.target.x;
            const targetDY = desiredProjected.y - leg.target.y;
            const targetDist = Math.hypot(targetDX, targetDY);
            const forwardError = targetDX * heading.x + targetDY * heading.y;
            const timeSinceStep = seconds - leg.lastStepTime;
            const triggerDistance = Math.max(leg.maxReach * 0.45, 14 + speed * 60);
            const forwardTrigger = Math.max(leg.maxReach * 0.3, 8 + speed * 36);
            const minInterval = 0.16;
            const phaseGate = Math.sin(phase) > -0.2;

            if (timeSinceStep > minInterval && phaseGate && sideStepping[leg.side] < 2 && (targetDist > triggerDistance || forwardError > forwardTrigger)) {
                leg.target.x = desiredProjected.x;
                leg.target.y = desiredProjected.y;
                leg.step = {
                    progress: 0,
                    duration: Math.max(0.18, leg.stepDuration - speed * 0.08),
                    originX: leg.foot.x,
                    originY: leg.foot.y,
                    targetX: desiredProjected.x,
                    targetY: desiredProjected.y,
                    lift: leg.lift * 0.45 + 12 + speed * 38
                };
                sideStepping[leg.side] += 1;
            }
        } else {
            leg.target.x = desiredProjected.x;
            leg.target.y = desiredProjected.y;
            leg.step.targetX = desiredProjected.x;
            leg.step.targetY = desiredProjected.y;
        }

        if (leg.step) {
            leg.step.progress = Math.min(1, leg.step.progress + delta / leg.step.duration);
            const eased = easeInOutQuad(leg.step.progress);
            const liftArc = Math.sin(leg.step.progress * Math.PI) * leg.step.lift;
            leg.foot.x = lerp(leg.step.originX, leg.step.targetX, eased);
            leg.foot.y = lerp(leg.step.originY, leg.step.targetY, eased) - liftArc;

            const constrainedStep = projectToReach(anchorX, anchorY, leg.foot.x, leg.foot.y, leg.minReach, leg.maxReach);
            leg.foot.x = constrainedStep.x;
            leg.foot.y = constrainedStep.y;

            if (leg.step.progress >= 1) {
                leg.foot.x = leg.step.targetX;
                leg.foot.y = leg.step.targetY;
                leg.target.x = leg.foot.x;
                leg.target.y = leg.foot.y;
                leg.step = null;
                leg.lastStepTime = seconds;
                sideStepping[leg.side] = Math.max(0, sideStepping[leg.side] - 1);
            }
        } else {
            const settle = Math.min(0.22 + speed * 0.32, 0.65);
            leg.foot.x = lerp(leg.foot.x, leg.target.x, settle);
            leg.foot.y = lerp(leg.foot.y, leg.target.y, settle);
        }

        const constrained = projectToReach(anchorX, anchorY, leg.foot.x, leg.foot.y, leg.minReach, leg.maxReach);
        leg.foot.x = constrained.x;
        leg.foot.y = constrained.y;

        solveChain(leg.bones, leg.foot.x, leg.foot.y, leg.anchor.x, leg.anchor.y);
    }

    prevThorax.x = thorax.x;
    prevThorax.y = thorax.y;
}

function drawBones(tipX, tipY, bones, widthStart, widthEnd, stroke, glow) {
    let endX = tipX;
    let endY = tipY;
    const count = bones.length;
    for (let i = 0; i < count; i++) {
        const bone = bones[i];
        const t = i / Math.max(count - 1, 1);
        const widthCurrent = widthStart + (widthEnd - widthStart) * t;
        if (glow) {
            ctx.strokeStyle = glow;
            ctx.lineWidth = widthCurrent * 2.2;
            ctx.globalAlpha = 0.15;
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(bone.x, bone.y);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = stroke;
        ctx.lineWidth = widthCurrent;
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(bone.x, bone.y);
        ctx.stroke();
        ctx.fillStyle = stroke;
        ctx.beginPath();
        ctx.arc(bone.x, bone.y, Math.max(widthCurrent * 0.46, 1.6), 0, Math.PI * 2);
        ctx.fill();
        endX = bone.x;
        endY = bone.y;
    }
    ctx.fillStyle = stroke;
    ctx.beginPath();
    ctx.arc(tipX, tipY, Math.max(widthStart * 0.5, 1.6), 0, Math.PI * 2);
    ctx.fill();
}

function draw(time) {
    ctx.fillStyle = 'rgba(4, 5, 8, 0.28)';
    ctx.fillRect(0, 0, width, height);

    const seconds = time * 0.001;
    const haze = ctx.createRadialGradient(thorax.x, thorax.y, 18, thorax.x, thorax.y, Math.max(width, height) * 0.55);
    haze.addColorStop(0, 'rgba(140, 150, 190, 0.06)');
    haze.addColorStop(1, 'rgba(2, 3, 4, 0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, width, height);

    const bodyAngle = Math.atan2(heading.y, heading.x);

    ctx.strokeStyle = 'rgba(220, 210, 195, 0.28)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(abdomen.x, abdomen.y);
    ctx.lineTo(thorax.x, thorax.y);
    ctx.lineTo(head.x, head.y);
    ctx.stroke();

    for (const leg of legs) {
        drawBones(leg.foot.x, leg.foot.y, leg.bones, 3.2, 11.5, 'rgba(228, 217, 198, 0.88)', 'rgba(200, 220, 250, 0.18)');
    }

    ctx.fillStyle = 'rgba(23, 24, 30, 0.94)';
    ctx.strokeStyle = 'rgba(234, 224, 210, 0.8)';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.ellipse(abdomen.x, abdomen.y, 44, 54, bodyAngle, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(thorax.x, thorax.y, 36, 30, bodyAngle, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(head.x, head.y, 20, 16, bodyAngle, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const forwardX = Math.cos(bodyAngle);
    const forwardY = Math.sin(bodyAngle);
    const normalX = -forwardY;
    const normalY = forwardX;

    const eyeLayout = [
        { forward: 8, lateral: -12, size: 3.4 },
        { forward: 7, lateral: -5, size: 3.1 },
        { forward: 7, lateral: 5, size: 3.1 },
        { forward: 8, lateral: 12, size: 3.4 },
        { forward: 4, lateral: -13, size: 2.6 },
        { forward: 3, lateral: -4, size: 2.8 },
        { forward: 3, lateral: 4, size: 2.8 },
        { forward: 4, lateral: 13, size: 2.6 }
    ];

    ctx.fillStyle = '#aefaff';
    ctx.shadowColor = 'rgba(160, 255, 255, 0.35)';
    ctx.shadowBlur = 8;
    for (const eye of eyeLayout) {
        const ex = head.x + forwardX * eye.forward + normalX * eye.lateral;
        const ey = head.y + forwardY * eye.forward + normalY * eye.lateral;
        ctx.beginPath();
        ctx.arc(ex, ey, eye.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.shadowBlur = 0;

    const jawBaseForward = 12;
    const jawLength = 34;
    const jawSpread = 12;
    const jawTaper = 4;

    ctx.fillStyle = 'rgba(160, 32, 44, 0.78)';
    ctx.strokeStyle = 'rgba(246, 236, 220, 0.92)';
    ctx.lineWidth = 1.9;

    for (const side of [-1, 1]) {
        const baseInnerX = head.x + forwardX * (jawBaseForward - 4) + normalX * (side * 3);
        const baseInnerY = head.y + forwardY * (jawBaseForward - 4) + normalY * (side * 3);
        const baseOuterX = head.x + forwardX * jawBaseForward + normalX * (side * jawSpread);
        const baseOuterY = head.y + forwardY * jawBaseForward + normalY * (side * jawSpread);
        const tipX = head.x + forwardX * (jawBaseForward + jawLength) + normalX * (side * jawTaper);
        const tipY = head.y + forwardY * (jawBaseForward + jawLength);
        ctx.beginPath();
        ctx.moveTo(baseInnerX, baseInnerY);
        ctx.lineTo(baseOuterX, baseOuterY);
        ctx.lineTo(tipX, tipY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(200, 220, 240, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(thorax.x, thorax.y, 120 + Math.sin(seconds * 1.3) * 6, 0, Math.PI * 2);
    ctx.stroke();
}

function loop(time) {
    update(time);
    draw(time);
    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
