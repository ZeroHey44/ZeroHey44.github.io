(function () {
    "use strict";

    if (!window.HTMLCanvasElement || document.querySelector(".cube-atmosphere")) {
        return;
    }

    const canvas = document.createElement("canvas");
    canvas.className = "cube-atmosphere";
    canvas.setAttribute("aria-hidden", "true");
    document.body.prepend(canvas);

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
        canvas.remove();
        return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const edges = [
        [0, 1], [1, 3], [3, 2], [2, 0],
        [4, 5], [5, 7], [7, 6], [6, 4],
        [0, 4], [1, 5], [2, 6], [3, 7]
    ];
    const faces = [
        [0, 1, 3, 2], [4, 6, 7, 5],
        [0, 4, 5, 1], [2, 3, 7, 6],
        [0, 2, 6, 4], [1, 5, 7, 3]
    ];
    const sourceVertices = [
        [-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1],
        [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1]
    ];

    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let cubes = [];
    let edgeBodies = [];
    let frameId = 0;
    let previousTime = performance.now();
    let resizeTimer = 0;

    const pointer = {
        x: window.innerWidth * 0.5,
        y: window.innerHeight * 0.5,
        smoothX: window.innerWidth * 0.5,
        smoothY: window.innerHeight * 0.5,
        strength: 0,
        targetStrength: 0
    };

    function random(min, max) {
        return min + Math.random() * (max - min);
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function mix(start, end, amount) {
        return start + (end - start) * amount;
    }

    function makeFragmentTraits(count, type) {
        return Array.from({ length: count }, function () {
            return {
                directionOffset: random(-0.9, 0.9),
                distance: type === "face" ? random(0.28, 1.08) : random(0.2, 1.18),
                rotation: type === "face" ? random(-0.52, 0.52) : random(-0.72, 0.72),
                scale: type === "face" ? random(0.68, 1.16) : random(0.24, 0.84)
            };
        });
    }

    function makeCube() {
        const depth = Math.random();
        return {
            x: random(-40, width + 40),
            y: random(-40, height + 40),
            size: mix(13, 38, depth),
            depth,
            velocityX: random(-5.5, 5.5) * (0.45 + depth * 0.65),
            velocityY: random(-4.5, 4.5) * (0.45 + depth * 0.65),
            rotationX: random(0, Math.PI * 2),
            rotationY: random(0, Math.PI * 2),
            rotationZ: random(0, Math.PI * 2),
            spinX: random(-0.12, 0.12),
            spinY: random(-0.18, 0.18),
            spinZ: random(-0.08, 0.08),
            phase: random(0, Math.PI * 2),
            hue: random(178, 205),
            seed: Math.random() * 1000,
            faceTraits: makeFragmentTraits(faces.length, "face"),
            edgeTraits: makeFragmentTraits(edges.length, "edge")
        };
    }

    function makeEdgeBody() {
        const edgeOptions = [2, 4, 5];
        const edgeCount = edgeOptions[Math.floor(Math.random() * edgeOptions.length)];
        const segmentSize = random(12, 27);
        const points = [{ x: 0, y: 0 }];
        let angle = random(0, Math.PI * 2);

        for (let index = 0; index < edgeCount; index += 1) {
            if (index > 0) {
                const turn = random(0.38, 1.2) * (Math.random() < 0.5 ? -1 : 1);
                angle += turn;
            }
            const previous = points[points.length - 1];
            const length = segmentSize * random(0.72, 1.22);
            points.push({
                x: previous.x + Math.cos(angle) * length,
                y: previous.y + Math.sin(angle) * length
            });
        }

        const center = points.reduce(function (sum, point) {
            sum.x += point.x;
            sum.y += point.y;
            return sum;
        }, { x: 0, y: 0 });
        center.x /= points.length;
        center.y /= points.length;
        points.forEach(function (point) {
            point.x -= center.x;
            point.y -= center.y;
        });

        const depth = Math.random();
        return {
            x: random(-60, width + 60),
            y: random(-60, height + 60),
            points,
            segmentSize,
            depth,
            velocityX: random(-4.8, 4.8) * (0.45 + depth * 0.65),
            velocityY: random(-4.2, 4.2) * (0.45 + depth * 0.65),
            rotation: random(0, Math.PI * 2),
            spin: random(-0.12, 0.12),
            phase: random(0, Math.PI * 2),
            hue: random(32, 58),
            seed: Math.random() * 1000,
            segmentTraits: makeFragmentTraits(edgeCount, "edge")
        };
    }

    function desiredCubeCount() {
        const areaCount = Math.round((width * height) / 42000);
        if (width <= 760) {
            return clamp(areaCount, 10, 18);
        }
        return clamp(areaCount, reducedMotion ? 14 : 22, reducedMotion ? 24 : 48);
    }

    function desiredEdgeBodyCount() {
        const areaCount = Math.round((width * height) / 125000);
        if (width <= 760) {
            return clamp(areaCount, 4, 8);
        }
        return clamp(areaCount, reducedMotion ? 5 : 7, reducedMotion ? 8 : 15);
    }

    function resize() {
        width = Math.max(1, window.innerWidth);
        height = Math.max(1, window.innerHeight);
        pixelRatio = Math.min(window.devicePixelRatio || 1, 1.6);
        canvas.width = Math.round(width * pixelRatio);
        canvas.height = Math.round(height * pixelRatio);
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        const targetCount = desiredCubeCount();
        while (cubes.length < targetCount) {
            cubes.push(makeCube());
        }
        if (cubes.length > targetCount) {
            cubes.length = targetCount;
        }

        const targetEdgeBodyCount = desiredEdgeBodyCount();
        while (edgeBodies.length < targetEdgeBodyCount) {
            edgeBodies.push(makeEdgeBody());
        }
        if (edgeBodies.length > targetEdgeBodyCount) {
            edgeBodies.length = targetEdgeBodyCount;
        }
    }

    function rotateVertex(vertex, cube, elapsed) {
        const angleX = cube.rotationX + elapsed * cube.spinX;
        const angleY = cube.rotationY + elapsed * cube.spinY;
        const angleZ = cube.rotationZ + elapsed * cube.spinZ;
        const sinX = Math.sin(angleX);
        const cosX = Math.cos(angleX);
        const sinY = Math.sin(angleY);
        const cosY = Math.cos(angleY);
        const sinZ = Math.sin(angleZ);
        const cosZ = Math.cos(angleZ);

        let x = vertex[0];
        let y = vertex[1] * cosX - vertex[2] * sinX;
        let z = vertex[1] * sinX + vertex[2] * cosX;

        const rotatedX = x * cosY + z * sinY;
        z = -x * sinY + z * cosY;
        x = rotatedX;

        return {
            x: x * cosZ - y * sinZ,
            y: x * sinZ + y * cosZ,
            z
        };
    }

    function projectVertices(cube, elapsed) {
        return sourceVertices.map(function (vertex) {
            const rotated = rotateVertex(vertex, cube, elapsed);
            const perspective = 1 / (1 + rotated.z * 0.16);
            return {
                x: rotated.x * cube.size * perspective,
                y: rotated.y * cube.size * perspective,
                z: rotated.z
            };
        });
    }

    function smoothInfluence(distance, radius) {
        const amount = clamp(1 - distance / radius, 0, 1);
        return amount * amount * (3 - 2 * amount);
    }

    function fragmentDirection(x, y, seed) {
        const length = Math.hypot(x, y);
        if (length > 0.001) {
            return { x: x / length, y: y / length };
        }
        const angle = seed * 12.9898;
        return { x: Math.cos(angle), y: Math.sin(angle) };
    }

    function rotateDirection(direction, angle) {
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);
        return {
            x: direction.x * cos - direction.y * sin,
            y: direction.x * sin + direction.y * cos
        };
    }

    function transformedFace(points, face, cube, influence, faceIndex) {
        let centerX = 0;
        let centerY = 0;
        for (let index = 0; index < face.length; index += 1) {
            centerX += points[face[index]].x;
            centerY += points[face[index]].y;
        }
        centerX /= face.length;
        centerY /= face.length;

        const traits = cube.faceTraits[faceIndex];
        const direction = rotateDirection(
            fragmentDirection(centerX, centerY, cube.seed + faceIndex * 0.37),
            traits.directionOffset
        );
        const breakDistance = cube.size * influence * traits.distance;
        const offsetX = direction.x * breakDistance;
        const offsetY = direction.y * breakDistance;
        const fragmentRotation = traits.rotation * influence;
        const fragmentScale = mix(1, traits.scale, influence);
        const sin = Math.sin(fragmentRotation);
        const cos = Math.cos(fragmentRotation);

        return face.map(function (vertexIndex) {
            const relativeX = (points[vertexIndex].x - centerX) * fragmentScale;
            const relativeY = (points[vertexIndex].y - centerY) * fragmentScale;
            return {
                x: centerX + relativeX * cos - relativeY * sin + offsetX,
                y: centerY + relativeX * sin + relativeY * cos + offsetY
            };
        });
    }

    function drawFaces(cube, points, influence) {
        const sortedFaces = faces.map(function (face, index) {
            const depth = face.reduce(function (sum, vertexIndex) {
                return sum + points[vertexIndex].z;
            }, 0) / face.length;
            return { face, index, depth };
        }).sort(function (first, second) {
            return first.depth - second.depth;
        });

        sortedFaces.forEach(function (entry) {
            const polygon = transformedFace(points, entry.face, cube, influence, entry.index);
            const hue = cube.hue + influence * 62;
            const fillAlpha = (0.012 + cube.depth * 0.016) + influence * 0.032;
            const strokeAlpha = 0.035 + cube.depth * 0.035 + influence * 0.1;

            context.beginPath();
            context.moveTo(cube.x + polygon[0].x, cube.y + polygon[0].y);
            for (let index = 1; index < polygon.length; index += 1) {
                context.lineTo(cube.x + polygon[index].x, cube.y + polygon[index].y);
            }
            context.closePath();
            context.fillStyle = "hsla(" + hue + ", 82%, 65%, " + fillAlpha + ")";
            context.strokeStyle = "hsla(" + hue + ", 88%, 72%, " + strokeAlpha + ")";
            context.lineWidth = 0.45 + cube.depth * 0.3;
            context.fill();
            context.stroke();
        });
    }

    function drawEdges(cube, points, influence) {
        const hue = cube.hue + influence * 62;
        const fragmentPower = Math.pow(influence, 1.2);

        edges.forEach(function (edge, edgeIndex) {
            const traits = cube.edgeTraits[edgeIndex];
            const first = points[edge[0]];
            const second = points[edge[1]];
            const midpointX = (first.x + second.x) * 0.5;
            const midpointY = (first.y + second.y) * 0.5;
            const direction = rotateDirection(
                fragmentDirection(midpointX, midpointY, cube.seed + edgeIndex * 0.71),
                traits.directionOffset
            );
            const breakDistance = cube.size * fragmentPower * traits.distance;
            const offsetX = direction.x * breakDistance;
            const offsetY = direction.y * breakDistance;
            const visibleLength = mix(1, traits.scale, influence);
            const edgeRotation = traits.rotation * influence;
            const edgeSin = Math.sin(edgeRotation);
            const edgeCos = Math.cos(edgeRotation);
            const rawHalfX = (second.x - first.x) * 0.5 * visibleLength;
            const rawHalfY = (second.y - first.y) * 0.5 * visibleLength;
            const halfX = rawHalfX * edgeCos - rawHalfY * edgeSin;
            const halfY = rawHalfX * edgeSin + rawHalfY * edgeCos;
            const centerX = cube.x + midpointX + offsetX;
            const centerY = cube.y + midpointY + offsetY;

            context.beginPath();
            context.moveTo(centerX - halfX, centerY - halfY);
            context.lineTo(centerX + halfX, centerY + halfY);
            context.strokeStyle = "hsla(" + hue + ", 94%, 76%, " + (0.24 + cube.depth * 0.3 + influence * 0.34) + ")";
            context.lineWidth = 0.65 + cube.depth * 0.75 + influence * 0.45;
            context.stroke();

            if (influence > 0.58 && edgeIndex % 2 === 0) {
                context.beginPath();
                context.arc(centerX + halfX, centerY + halfY, 0.8 + influence * 1.1, 0, Math.PI * 2);
                context.fillStyle = "hsla(" + hue + ", 100%, 82%, " + (influence * 0.55) + ")";
                context.fill();
            }
        });
    }

    function rotatedEdgeBodyPoints(body, elapsed) {
        const angle = body.rotation + elapsed * body.spin;
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);
        return body.points.map(function (point) {
            return {
                x: point.x * cos - point.y * sin,
                y: point.x * sin + point.y * cos
            };
        });
    }

    function drawEdgeBody(body, influence, elapsed) {
        const points = rotatedEdgeBodyPoints(body, elapsed);
        const fragmentPower = Math.pow(influence, 1.18);
        const hue = (body.hue + influence * 145) % 360;

        body.segmentTraits.forEach(function (traits, segmentIndex) {
            const first = points[segmentIndex];
            const second = points[segmentIndex + 1];
            const midpointX = (first.x + second.x) * 0.5;
            const midpointY = (first.y + second.y) * 0.5;
            const direction = rotateDirection(
                fragmentDirection(midpointX, midpointY, body.seed + segmentIndex * 0.83),
                traits.directionOffset
            );
            const breakDistance = body.segmentSize * fragmentPower * traits.distance * 1.25;
            const offsetX = direction.x * breakDistance;
            const offsetY = direction.y * breakDistance;
            const segmentScale = mix(1, traits.scale, influence);
            const segmentRotation = traits.rotation * influence;
            const segmentSin = Math.sin(segmentRotation);
            const segmentCos = Math.cos(segmentRotation);
            const rawHalfX = (second.x - first.x) * 0.5 * segmentScale;
            const rawHalfY = (second.y - first.y) * 0.5 * segmentScale;
            const halfX = rawHalfX * segmentCos - rawHalfY * segmentSin;
            const halfY = rawHalfX * segmentSin + rawHalfY * segmentCos;
            const centerX = body.x + midpointX + offsetX;
            const centerY = body.y + midpointY + offsetY;

            context.beginPath();
            context.moveTo(centerX - halfX, centerY - halfY);
            context.lineTo(centerX + halfX, centerY + halfY);
            context.strokeStyle = "hsla(" + hue + ", 96%, 76%, " + (0.25 + body.depth * 0.34 + influence * 0.28) + ")";
            context.lineWidth = 0.75 + body.depth * 0.95 + influence * 0.38;
            context.stroke();

            if (influence > 0.5) {
                context.beginPath();
                context.arc(centerX - halfX, centerY - halfY, 0.65 + body.depth * 0.7, 0, Math.PI * 2);
                context.fillStyle = "hsla(" + hue + ", 100%, 84%, " + (influence * 0.42) + ")";
                context.fill();
            }
        });

        if (influence < 0.82) {
            points.forEach(function (point) {
                context.beginPath();
                context.arc(body.x + point.x, body.y + point.y, 0.7 + body.depth * 0.75, 0, Math.PI * 2);
                context.fillStyle = "hsla(" + hue + ", 94%, 82%, " + ((1 - influence) * (0.22 + body.depth * 0.3)) + ")";
                context.fill();
            });
        }
    }

    function drawPointerAtmosphere(radius) {
        if (pointer.strength < 0.01) {
            return;
        }

        const gradient = context.createRadialGradient(
            pointer.smoothX,
            pointer.smoothY,
            0,
            pointer.smoothX,
            pointer.smoothY,
            radius
        );
        gradient.addColorStop(0, "rgba(154, 244, 255, " + (0.13 * pointer.strength) + ")");
        gradient.addColorStop(0.38, "rgba(105, 170, 255, " + (0.075 * pointer.strength) + ")");
        gradient.addColorStop(0.72, "rgba(145, 104, 255, " + (0.035 * pointer.strength) + ")");
        gradient.addColorStop(1, "rgba(70, 140, 220, 0)");
        context.fillStyle = gradient;
        context.fillRect(pointer.smoothX - radius, pointer.smoothY - radius, radius * 2, radius * 2);

        context.beginPath();
        context.arc(pointer.smoothX, pointer.smoothY, radius * 0.22, 0, Math.PI * 2);
        context.strokeStyle = "rgba(169, 247, 255, " + (0.055 * pointer.strength) + ")";
        context.lineWidth = 1;
        context.stroke();
    }

    function updateCube(cube, delta, elapsed) {
        if (!reducedMotion) {
            cube.x += cube.velocityX * delta;
            cube.y += cube.velocityY * delta;
            cube.x += Math.sin(elapsed * 0.34 + cube.phase) * delta * 1.1;
            cube.y += Math.cos(elapsed * 0.28 + cube.phase) * delta * 0.9;
        }

        const margin = cube.size * 2.8;
        if (cube.x < -margin) cube.x = width + margin;
        if (cube.x > width + margin) cube.x = -margin;
        if (cube.y < -margin) cube.y = height + margin;
        if (cube.y > height + margin) cube.y = -margin;
    }

    function updateEdgeBody(body, delta, elapsed) {
        if (!reducedMotion) {
            body.x += body.velocityX * delta;
            body.y += body.velocityY * delta;
            body.x += Math.cos(elapsed * 0.25 + body.phase) * delta * 0.85;
            body.y += Math.sin(elapsed * 0.31 + body.phase) * delta * 0.75;
        }

        const margin = body.segmentSize * 5.5;
        if (body.x < -margin) body.x = width + margin;
        if (body.x > width + margin) body.x = -margin;
        if (body.y < -margin) body.y = height + margin;
        if (body.y > height + margin) body.y = -margin;
    }

    function render(time) {
        const delta = Math.min((time - previousTime) / 1000, 0.05);
        const elapsed = time / 1000;
        previousTime = time;

        pointer.smoothX += (pointer.x - pointer.smoothX) * 0.12;
        pointer.smoothY += (pointer.y - pointer.smoothY) * 0.12;
        pointer.strength += (pointer.targetStrength - pointer.strength) * 0.09;

        context.clearRect(0, 0, width, height);
        context.save();
        context.globalCompositeOperation = "screen";
        context.lineCap = "round";
        context.lineJoin = "round";

        const influenceRadius = clamp(Math.min(width, height) * 0.32, 190, 330);
        drawPointerAtmosphere(influenceRadius);

        edgeBodies.sort(function (first, second) {
            return first.depth - second.depth;
        });

        edgeBodies.forEach(function (body) {
            updateEdgeBody(body, delta, elapsed);
            const distance = Math.hypot(body.x - pointer.smoothX, body.y - pointer.smoothY);
            const influence = smoothInfluence(distance, influenceRadius) * pointer.strength;
            drawEdgeBody(body, influence, reducedMotion ? 0 : elapsed);
        });

        cubes.sort(function (first, second) {
            return first.depth - second.depth;
        });

        cubes.forEach(function (cube) {
            updateCube(cube, delta, elapsed);
            const distance = Math.hypot(cube.x - pointer.smoothX, cube.y - pointer.smoothY);
            const influence = smoothInfluence(distance, influenceRadius) * pointer.strength;
            const points = projectVertices(cube, reducedMotion ? 0 : elapsed);
            drawFaces(cube, points, influence);
            drawEdges(cube, points, influence);
        });

        context.restore();
        frameId = window.requestAnimationFrame(render);
    }

    function setPointer(event) {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        pointer.targetStrength = 1;
    }

    window.addEventListener("pointermove", setPointer, { passive: true });
    window.addEventListener("pointerdown", setPointer, { passive: true });
    window.addEventListener("pointerup", function (event) {
        if (event.pointerType !== "mouse") {
            pointer.targetStrength = 0;
        }
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", function () {
        pointer.targetStrength = 0;
    });
    window.addEventListener("blur", function () {
        pointer.targetStrength = 0;
    });
    window.addEventListener("resize", function () {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(resize, 120);
    }, { passive: true });
    document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
            window.cancelAnimationFrame(frameId);
            frameId = 0;
        } else if (!frameId) {
            previousTime = performance.now();
            frameId = window.requestAnimationFrame(render);
        }
    });

    resize();
    frameId = window.requestAnimationFrame(render);
}());
