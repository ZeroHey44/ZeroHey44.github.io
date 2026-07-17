(function () {
    "use strict";

    var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (!finePointer.matches || reducedMotion.matches) return;

    var canvas = document.createElement("canvas");
    var context = canvas.getContext("2d");
    var trail = [];
    var trailLifetime = 320;
    var pointerX = 0;
    var pointerY = 0;
    var directionAnchorX = 0;
    var directionAnchorY = 0;
    var pointerAngle = -Math.PI * 0.75;
    var targetPointerAngle = pointerAngle;
    var pointerVisible = false;
    var pointerPressed = false;
    var framePending = false;

    if (!context) return;

    canvas.className = "sci-fi-cursor is-hidden";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);

    function resizeCanvas() {
        var pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
        canvas.width = Math.round(window.innerWidth * pixelRatio);
        canvas.height = Math.round(window.innerHeight * pixelRatio);
        canvas.style.width = window.innerWidth + "px";
        canvas.style.height = window.innerHeight + "px";
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        requestRender();
    }

    function requestRender() {
        if (framePending) return;
        framePending = true;
        window.requestAnimationFrame(render);
    }

    function addTrailPoint(x, y, now) {
        var lastPoint = trail[trail.length - 1];
        if (lastPoint) {
            var offsetX = x - lastPoint.x;
            var offsetY = y - lastPoint.y;
            if ((offsetX * offsetX) + (offsetY * offsetY) < 3 && now - lastPoint.time < 14) return;
        }

        trail.push({ x: x, y: y, time: now });
        if (trail.length > 28) trail.shift();
    }

    function drawTrail(now) {
        trail = trail.filter(function (point) {
            return now - point.time < trailLifetime;
        });

        if (trail.length < 2) return;

        context.lineCap = "round";
        context.lineJoin = "round";

        for (var index = 1; index < trail.length; index += 1) {
            var previousPoint = trail[index - 1];
            var currentPoint = trail[index];
            var life = Math.max(0, 1 - ((now - currentPoint.time) / trailLifetime));

            context.beginPath();
            context.moveTo(previousPoint.x, previousPoint.y);
            context.lineTo(currentPoint.x, currentPoint.y);
            context.strokeStyle = "rgba(47, 221, 235," + (life * 0.16) + ")";
            context.lineWidth = 7 * life;
            context.stroke();

            context.beginPath();
            context.moveTo(previousPoint.x, previousPoint.y);
            context.lineTo(currentPoint.x, currentPoint.y);
            context.strokeStyle = "rgba(181, 255, 248," + (life * 0.68) + ")";
            context.lineWidth = Math.max(0.55, 1.8 * life);
            context.stroke();
        }
    }

    function drawPointer() {
        if (!pointerVisible) return;

        var scale = pointerPressed ? 0.82 : 1;

        context.save();
        context.translate(pointerX, pointerY);
        context.rotate(pointerAngle);
        context.scale(scale, scale);

        context.beginPath();
        context.moveTo(14, 0);
        context.lineTo(-7, -10);
        context.lineTo(-7, 10);
        context.closePath();
        context.fillStyle = "rgba(61, 236, 225, 0.2)";
        context.fill();

        context.beginPath();
        context.moveTo(11, 0);
        context.lineTo(-5.5, -8);
        context.lineTo(-5.5, 8);
        context.closePath();

        var pointerFill = context.createLinearGradient(-6, -7, 10, 6);
        pointerFill.addColorStop(0, "rgba(231, 255, 252, 1)");
        pointerFill.addColorStop(0.42, "rgba(126, 250, 239, 1)");
        pointerFill.addColorStop(1, "rgba(45, 211, 216, 1)");
        context.fillStyle = pointerFill;
        context.fill();

        context.restore();
    }

    function updatePointerAngle() {
        var angleDifference = Math.atan2(
            Math.sin(targetPointerAngle - pointerAngle),
            Math.cos(targetPointerAngle - pointerAngle)
        );

        if (Math.abs(angleDifference) < 0.002) {
            pointerAngle = targetPointerAngle;
            return false;
        }

        pointerAngle += angleDifference * 0.22;
        return true;
    }

    function render(now) {
        framePending = false;
        context.clearRect(0, 0, window.innerWidth, window.innerHeight);
        context.globalCompositeOperation = "lighter";
        var angleIsSettling = updatePointerAngle();
        drawTrail(now);
        drawPointer();
        context.globalCompositeOperation = "source-over";

        if (pointerVisible && (trail.length > 1 || angleIsSettling)) requestRender();
    }

    function handlePointerMove(event) {
        var now = performance.now();

        if (!pointerVisible) {
            directionAnchorX = event.clientX;
            directionAnchorY = event.clientY;
        } else {
            var directionX = event.clientX - directionAnchorX;
            var directionY = event.clientY - directionAnchorY;

            if ((directionX * directionX) + (directionY * directionY) >= 36) {
                targetPointerAngle = Math.atan2(directionY, directionX);
                directionAnchorX = event.clientX;
                directionAnchorY = event.clientY;
            }
        }

        pointerX = event.clientX;
        pointerY = event.clientY;
        pointerVisible = true;
        canvas.classList.remove("is-hidden");
        addTrailPoint(pointerX, pointerY, now);
        requestRender();
    }

    function hidePointer() {
        pointerVisible = false;
        pointerPressed = false;
        trail.length = 0;
        canvas.classList.add("is-hidden");
        requestRender();
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", function () {
        pointerPressed = true;
        requestRender();
    }, { passive: true });
    window.addEventListener("pointerup", function () {
        pointerPressed = false;
        requestRender();
    }, { passive: true });
    document.documentElement.addEventListener("mouseleave", hidePointer);
    window.addEventListener("blur", hidePointer);
    window.addEventListener("resize", resizeCanvas, { passive: true });
    document.addEventListener("visibilitychange", function () {
        if (document.hidden) hidePointer();
    });

    Array.prototype.forEach.call(document.querySelectorAll("iframe"), function (frame) {
        frame.addEventListener("mouseenter", hidePointer);
    });

    resizeCanvas();
}());
