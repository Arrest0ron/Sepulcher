const canvas = document.getElementById('wyvern');
const ctx = canvas.getContext('2d');
let width = 0;
let height = 0;
let dpr = window.devicePixelRatio || 1;

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

function createBones(lengths) {
    return lengths.map(length => ({ x: width * 0.5, y: height * 0.5, length, angle: 0 }));
}

const legBlueprints = [
    { anchorForward: 28, anchorSide: 26, restForward: 96, restSide: 126, phase: 0.0, stepForward: 26, stepSide: 16, lift: 30 },
    { anchorForward: 6, anchorSide: 32, restForward: 58, restSide: 140, phase: Math.PI * 0.5, stepForward: 24, stepSide: 16, lift: 34 },
    { anchorForward: -18, anchorSide: 30, restForward: 8, restSide: 128, phase: Math.PI, stepForward: 20, stepSide: 14, lift: 28 },
    { anchorForward: -44, anchorSide: 24, restForward: -46, restSide: 110, phase: Math.PI * 1.5, stepForward: 22, stepSide: 12, lift: 24 }
];

const mouse = { x: width * 0.5, y: height * 0.5, active: false };

window.addEventListener('pointermove', event => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    mouse.active = true;
});

window.addEventListener('pointerleave', () => {
    mouse.active = false;
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

function initializeLegs() {
    legs = [];
    for (const blueprint of legBlueprints) {
        for (const side of [-1, 1]) {
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
                bones: createBones([32, 48, 62]),
                foot: { x: thorax.x, y: thorax.y },
                anchor: { x: thorax.x, y: thorax.y }
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
    thorax.x = lerp(thorax.x, targetX, 0.16);
    thorax.y = lerp(thorax.y, targetY, 0.16);

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

    const abdomenTargetX = thorax.x - heading.x * 82 + normalX * Math.sin(seconds * 1.3) * 12;
    const abdomenTargetY = thorax.y - heading.y * 82 + normalY * Math.sin(seconds * 1.3) * 12 + Math.cos(seconds * 1.8) * 6;
    abdomen.x = lerp(abdomen.x, abdomenTargetX, 0.18 + delta * 0.6);
    abdomen.y = lerp(abdomen.y, abdomenTargetY, 0.18 + delta * 0.6);

    const headTargetX = thorax.x + heading.x * 58 + normalX * Math.sin(seconds * 2.4) * 10;
    const headTargetY = thorax.y + heading.y * 58 + normalY * Math.sin(seconds * 2.4) * 10;
    head.x = lerp(head.x, headTargetX, 0.22 + delta * 0.4);
    head.y = lerp(head.y, headTargetY, 0.22 + delta * 0.4);

    const sway = Math.sin(seconds * 3.2) * 6;
    const bob = Math.sin(seconds * 2.1) * 10;
    const strideSpeed = 2.1 + speed * 12;

    for (const leg of legs) {
        const anchorX = thorax.x + heading.x * leg.anchorForward + normalX * (leg.anchorSide * leg.side) + normalX * sway * 0.4;
        const anchorY = thorax.y + heading.y * leg.anchorForward + normalY * (leg.anchorSide * leg.side) + normalY * sway * 0.4;
        leg.anchor.x = anchorX;
        leg.anchor.y = anchorY;

        const phase = seconds * strideSpeed + leg.phase;
        const forwardReach = Math.sin(phase) * leg.stepForward * (0.35 + speed * 0.9);
        const lateralDrift = Math.cos(phase) * leg.stepSide * 0.25;
        const lift = Math.pow(Math.max(0, Math.sin(phase)), 1.8) * leg.lift;

        const desiredFootX = thorax.x + heading.x * (leg.restForward + forwardReach) + normalX * ((leg.restSide + lateralDrift) * leg.side);
        const desiredFootY = thorax.y + heading.y * (leg.restForward + forwardReach) + normalY * ((leg.restSide + lateralDrift) * leg.side) + lift - bob * 0.4;

        const follow = 0.32 + speed * 0.5;
        leg.foot.x = lerp(leg.foot.x, desiredFootX, Math.min(follow, 0.72));
        leg.foot.y = lerp(leg.foot.y, desiredFootY, Math.min(follow, 0.72));

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

    const mandibleBaseForward = 14;
    const mandibleBaseLateral = 8.5;
    const mandibleDrop = 6;
    const fangLengthForward = 30;
    const fangLengthDown = 26;

    ctx.fillStyle = 'rgba(110, 8, 18, 0.62)';
    ctx.strokeStyle = 'rgba(246, 234, 220, 0.92)';
    ctx.lineWidth = 2.2;

    ctx.beginPath();
    const mawLeftX = head.x + forwardX * (mandibleBaseForward - 4) + normalX * -10;
    const mawLeftY = head.y + forwardY * (mandibleBaseForward - 4) + normalY * -4 + mandibleDrop;
    const mawRightX = head.x + forwardX * (mandibleBaseForward - 4) + normalX * 10;
    const mawRightY = head.y + forwardY * (mandibleBaseForward - 4) + normalY * 4 + mandibleDrop;
    const mawTipX = head.x + forwardX * (mandibleBaseForward + 16);
    const mawTipY = head.y + forwardY * (mandibleBaseForward + 16) + mandibleDrop * 1.6;
    ctx.moveTo(mawLeftX, mawLeftY);
    ctx.lineTo(mawTipX, mawTipY);
    ctx.lineTo(mawRightX, mawRightY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    for (const side of [-1, 1]) {
        const baseX = head.x + forwardX * mandibleBaseForward + normalX * (mandibleBaseLateral * side);
        const baseY = head.y + forwardY * mandibleBaseForward + normalY * (mandibleBaseLateral * side) + mandibleDrop;
        const tipX = baseX + forwardX * fangLengthForward + normalX * (-side * 6);
        const tipY = baseY + forwardY * fangLengthForward + fangLengthDown + mandibleDrop * 0.6;
        ctx.beginPath();
        ctx.moveTo(baseX, baseY);
        ctx.quadraticCurveTo(
            baseX + forwardX * (fangLengthForward * 0.45) + normalX * (side * 12),
            baseY + forwardY * (fangLengthForward * 0.45) + fangLengthDown * 0.4,
            tipX,
            tipY
        );
        ctx.lineTo(tipX + normalX * (side * 4), tipY - 4);
        ctx.quadraticCurveTo(
            baseX + forwardX * (fangLengthForward * 0.35) + normalX * (side * 4),
            baseY + forwardY * (fangLengthForward * 0.35) + fangLengthDown * 0.1,
            baseX,
            baseY
        );
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
