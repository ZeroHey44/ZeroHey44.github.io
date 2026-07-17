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
    const edgeGroups = [
        [0, 1, 11],
        [2, 3, 8],
        [4, 5, 9],
        [6, 7, 10]
    ];
    const connectedCubeEdgeGroups = edgeGroups.map(function (edgeGroup) {
        return createConnectedGroup(edgeGroup.map(function (edgeIndex) {
            return edges[edgeIndex];
        }));
    });
    const sourceVertices = [
        [-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1],
        [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1]
    ];

    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let cubes = [];
    let edgeBodies = [];
    let shockwaves = [];
    let frameId = 0;
    let renderingStarted = false;
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

    function createConnectedGroup(connectedEdges) {
        const vertexIndices = [];
        const degrees = {};
        connectedEdges.forEach(function (edge) {
            edge.forEach(function (vertexIndex) {
                if (!vertexIndices.includes(vertexIndex)) {
                    vertexIndices.push(vertexIndex);
                }
                degrees[vertexIndex] = (degrees[vertexIndex] || 0) + 1;
            });
        });
        return {
            edges: connectedEdges,
            vertexIndices,
            jointIndices: vertexIndices.filter(function (vertexIndex) {
                return degrees[vertexIndex] > 1;
            })
        };
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

    function makeEdgeGroupTraits(count) {
        return Array.from({ length: count }, function () {
            return {
                directionOffset: random(-0.78, 0.78),
                distance: random(0.34, 1.08),
                rotation: random(-0.44, 0.44),
                scale: random(0.74, 1.18),
                angleSpread: random(0.28, 0.62)
            };
        });
    }

    function makePolylineGroups(edgeCount) {
        if (edgeCount === 2) {
            return [[0, 1]];
        }
        if (edgeCount === 4) {
            return [[0, 1], [2, 3]];
        }
        return [[0, 1, 2], [3, 4]];
    }

    function makeCube() {
        const depth = Math.random();
        return {
            x: random(-40, width + 40),
            y: random(-40, height + 40),
            size: mix(13, 56, depth),
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
            shockLevel: 0,
            shockRepelX: 0,
            shockRepelY: 0,
            faceTraits: makeFragmentTraits(faces.length, "face"),
            edgeGroupTraits: makeEdgeGroupTraits(edgeGroups.length),
            faceOrder: [0, 1, 2, 3, 4, 5],
            faceDepths: [0, 0, 0, 0, 0, 0]
        };
    }

    function makeEdgeBody() {
        const edgeOptions = [2, 4, 5];
        const edgeCount = edgeOptions[Math.floor(Math.random() * edgeOptions.length)];
        const segmentSize = random(12, 38);
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

        const segmentGroups = makePolylineGroups(edgeCount);
        const connectedGroups = segmentGroups.map(function (segmentGroup) {
            return createConnectedGroup(segmentGroup.map(function (segmentIndex) {
                return [segmentIndex, segmentIndex + 1];
            }));
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
            shockLevel: 0,
            shockRepelX: 0,
            shockRepelY: 0,
            segmentGroups,
            connectedGroups,
            groupTraits: makeEdgeGroupTraits(segmentGroups.length)
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
        pixelRatio = Math.min(window.devicePixelRatio || 1, 1.2);
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
        cubes.sort(function (first, second) {
            return first.depth - second.depth;
        });
        edgeBodies.sort(function (first, second) {
            return first.depth - second.depth;
        });
    }

    function projectVertices(cube, elapsed) {
        const angleX = cube.rotationX + elapsed * cube.spinX;
        const angleY = cube.rotationY + elapsed * cube.spinY;
        const angleZ = cube.rotationZ + elapsed * cube.spinZ;
        const sinX = Math.sin(angleX);
        const cosX = Math.cos(angleX);
        const sinY = Math.sin(angleY);
        const cosY = Math.cos(angleY);
        const sinZ = Math.sin(angleZ);
        const cosZ = Math.cos(angleZ);

        return sourceVertices.map(function (vertex) {
            let x = vertex[0];
            let y = vertex[1] * cosX - vertex[2] * sinX;
            let z = vertex[1] * sinX + vertex[2] * cosX;
            const rotatedX = x * cosY + z * sinY;
            z = -x * sinY + z * cosY;
            x = rotatedX;
            const projectedX = x * cosZ - y * sinZ;
            const projectedY = x * sinZ + y * cosZ;
            const perspective = 1 / (1 + z * 0.16);
            return {
                x: projectedX * cube.size * perspective,
                y: projectedY * cube.size * perspective,
                z
            };
        });
    }

    function smoothInfluence(distance, radius) {
        const amount = clamp(1 - distance / radius, 0, 1);
        return amount * amount * (3 - 2 * amount);
    }

    function launchShockwave(event) {
        if (event.button !== undefined && event.button !== 0) {
            return;
        }
        shockwaves.push({
            x: event.clientX,
            y: event.clientY,
            age: 0,
            duration: 1.6,
            radius: 0,
            maxRadius: Math.hypot(width, height) + 160
        });
        if (shockwaves.length > 4) {
            shockwaves.shift();
        }
    }

    function updateShockwaves(delta) {
        shockwaves.forEach(function (wave) {
            wave.age += delta;
            const progress = clamp(wave.age / wave.duration, 0, 1);
            wave.radius = wave.maxRadius * (1 - Math.pow(1 - progress, 1.35));
        });
        shockwaves = shockwaves.filter(function (wave) {
            return wave.age < wave.duration;
        });
    }

    function shockwaveInfluence(wave, objectX, objectY) {
        const progress = clamp(wave.age / wave.duration, 0, 1);
        const distance = Math.hypot(objectX - wave.x, objectY - wave.y);
        const band = mix(58, 145, progress);
        const distanceFromWave = distance - wave.radius;
        const ringAmount = Math.exp(-(distanceFromWave * distanceFromWave) / (2 * band * band));
        return ringAmount * 0.3 * (1 - progress * 0.55);
    }

    function influenceAt(object, pointerRadius, delta) {
        const pointerDeltaX = object.x - pointer.smoothX;
        const pointerDeltaY = object.y - pointer.smoothY;
        const pointerDistance = Math.hypot(pointerDeltaX, pointerDeltaY);
        const pointerAmount = smoothInfluence(pointerDistance, pointerRadius) * pointer.strength;
        let liveShockAmount = 0;
        let liveShockVectorX = 0;
        let liveShockVectorY = 0;

        shockwaves.forEach(function (wave) {
            const waveAmount = shockwaveInfluence(wave, object.x, object.y);
            if (waveAmount < 0.001) return;
            const waveDeltaX = object.x - wave.x;
            const waveDeltaY = object.y - wave.y;
            const waveDistance = Math.hypot(waveDeltaX, waveDeltaY);
            if (waveDistance > 0.001) {
                liveShockVectorX += waveDeltaX / waveDistance * waveAmount;
                liveShockVectorY += waveDeltaY / waveDistance * waveAmount;
            }
            liveShockAmount = 1 - (1 - liveShockAmount) * (1 - waveAmount);
        });

        if (liveShockAmount > object.shockLevel) {
            object.shockLevel += (liveShockAmount - object.shockLevel) * 0.58;
        } else {
            object.shockLevel = Math.max(liveShockAmount, object.shockLevel - delta * 0.17);
        }

        const liveShockVectorLength = Math.hypot(liveShockVectorX, liveShockVectorY);
        if (liveShockVectorLength > 0.001) {
            object.shockRepelX = liveShockVectorX / liveShockVectorLength;
            object.shockRepelY = liveShockVectorY / liveShockVectorLength;
        }

        const shockAmount = object.shockLevel;
        const combinedAmount = 1 - (1 - pointerAmount) * (1 - shockAmount);
        const vectorX = object.shockRepelX * shockAmount;
        const vectorY = object.shockRepelY * shockAmount;
        const vectorLength = Math.hypot(vectorX, vectorY);
        return {
            amount: clamp(combinedAmount, 0, 1),
            pointerAmount,
            shockAmount,
            repelX: vectorLength > 0.001 ? vectorX / vectorLength : 0,
            repelY: vectorLength > 0.001 ? vectorY / vectorLength : 0
        };
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

    function normalizeAngle(angle) {
        let normalized = angle;
        while (normalized > Math.PI) normalized -= Math.PI * 2;
        while (normalized < -Math.PI) normalized += Math.PI * 2;
        return normalized;
    }

    function transformConnectedEdges(points, connectedGroup, traits, influence, size, seed, repel) {
        const vertexIndices = connectedGroup.vertexIndices;
        let centerX = 0;
        let centerY = 0;
        vertexIndices.forEach(function (vertexIndex) {
            centerX += points[vertexIndex].x;
            centerY += points[vertexIndex].y;
        });
        centerX /= vertexIndices.length;
        centerY /= vertexIndices.length;

        const originDirection = fragmentDirection(centerX, centerY, seed);
        const direction = rotateDirection(
            originDirection,
            traits.directionOffset
        );
        const fragmentPower = Math.pow(influence, 1.16);
        const releaseDistance = size * fragmentPower * (0.78 + traits.distance * 0.56);
        const breakDistance = size * fragmentPower * traits.distance * 0.52;
        const repelDistance = size * fragmentPower * (1.08 + traits.distance * 0.62);
        const offsetX = originDirection.x * releaseDistance + direction.x * breakDistance + repel.x * repelDistance;
        const offsetY = originDirection.y * releaseDistance + direction.y * breakDistance + repel.y * repelDistance;
        const groupScale = mix(1, traits.scale, influence);
        const groupRotation = traits.rotation * influence;
        const angleMultiplier = 1 + traits.angleSpread * influence;
        const anchorPoint = points[vertexIndices[0]];
        const anchorAngle = Math.atan2(anchorPoint.y - centerY, anchorPoint.x - centerX);
        const transformed = {};

        vertexIndices.forEach(function (vertexIndex) {
            const point = points[vertexIndex];
            const relativeX = point.x - centerX;
            const relativeY = point.y - centerY;
            const radius = Math.hypot(relativeX, relativeY) * groupScale;
            const baseAngle = Math.atan2(relativeY, relativeX);
            const relativeAngle = normalizeAngle(baseAngle - anchorAngle);
            const openedAngle = anchorAngle + relativeAngle * angleMultiplier + groupRotation;
            transformed[vertexIndex] = {
                x: centerX + Math.cos(openedAngle) * radius + offsetX,
                y: centerY + Math.sin(openedAngle) * radius + offsetY
            };
        });

        return transformed;
    }

    function transformedFace(points, face, cube, influence, faceIndex, repel) {
        let centerX = 0;
        let centerY = 0;
        for (let index = 0; index < face.length; index += 1) {
            centerX += points[face[index]].x;
            centerY += points[face[index]].y;
        }
        centerX /= face.length;
        centerY /= face.length;

        const traits = cube.faceTraits[faceIndex];
        const originDirection = fragmentDirection(centerX, centerY, cube.seed + faceIndex * 0.37);
        const direction = rotateDirection(
            originDirection,
            traits.directionOffset
        );
        const fragmentPower = Math.pow(influence, 1.08);
        const releaseDistance = cube.size * fragmentPower * (0.74 + traits.distance * 0.54);
        const breakDistance = cube.size * fragmentPower * traits.distance * 0.5;
        const repelDistance = cube.size * Math.pow(influence, 1.05) * (1.02 + traits.distance * 0.52);
        const offsetX = originDirection.x * releaseDistance + direction.x * breakDistance + repel.x * repelDistance;
        const offsetY = originDirection.y * releaseDistance + direction.y * breakDistance + repel.y * repelDistance;
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

    function drawFaces(cube, points, influence, repel, pointerFade, shockHighlight) {
        const highlightStrength = clamp(shockHighlight / 0.3, 0, 1);
        faces.forEach(function (face, faceIndex) {
            cube.faceDepths[faceIndex] = face.reduce(function (sum, vertexIndex) {
                return sum + points[vertexIndex].z;
            }, 0) / face.length;
        });
        cube.faceOrder.sort(function (firstIndex, secondIndex) {
            return cube.faceDepths[firstIndex] - cube.faceDepths[secondIndex];
        });
        cube.faceOrder.forEach(function (faceIndex) {
            const polygon = transformedFace(points, faces[faceIndex], cube, influence, faceIndex, repel);
            const hue = cube.hue + influence * 62;
            const highlightedHue = mix(hue, 187, highlightStrength);
            const faceVisibility = Math.pow(1 - clamp(pointerFade, 0, 1), 1.45);
            const fillAlpha = ((0.012 + cube.depth * 0.016) + influence * 0.024 + highlightStrength * 0.03) * faceVisibility;
            const strokeAlpha = (0.035 + cube.depth * 0.035 + influence * 0.08 + highlightStrength * 0.16) * Math.sqrt(faceVisibility);

            context.beginPath();
            context.moveTo(cube.x + polygon[0].x, cube.y + polygon[0].y);
            for (let index = 1; index < polygon.length; index += 1) {
                context.lineTo(cube.x + polygon[index].x, cube.y + polygon[index].y);
            }
            context.closePath();
            context.fillStyle = "hsla(" + highlightedHue + ", 92%, " + (65 + highlightStrength * 26) + "%, " + fillAlpha + ")";
            context.strokeStyle = "hsla(" + highlightedHue + ", 100%, " + (72 + highlightStrength * 24) + "%, " + strokeAlpha + ")";
            context.lineWidth = 0.45 + cube.depth * 0.3;
            context.fill();
            context.stroke();
        });
    }

    function drawEdges(cube, points, influence, repel, shockHighlight) {
        const hue = cube.hue + influence * 62;
        const highlightStrength = clamp(shockHighlight / 0.3, 0, 1);

        connectedCubeEdgeGroups.forEach(function (connectedGroup, groupIndex) {
            const transformed = transformConnectedEdges(
                points,
                connectedGroup,
                cube.edgeGroupTraits[groupIndex],
                influence,
                cube.size,
                cube.seed + groupIndex * 1.37,
                repel
            );

            connectedGroup.edges.forEach(function (edge) {
                const first = transformed[edge[0]];
                const second = transformed[edge[1]];

                context.beginPath();
                context.moveTo(cube.x + first.x, cube.y + first.y);
                context.lineTo(cube.x + second.x, cube.y + second.y);
                const edgeHue = mix(hue + groupIndex * 4, 185, highlightStrength);
                context.strokeStyle = "hsla(" + edgeHue + ", 100%, " + (76 + highlightStrength * 20) + "%, " + (0.24 + cube.depth * 0.3 + influence * 0.34 + highlightStrength * 0.16) + ")";
                context.lineWidth = 0.65 + cube.depth * 0.75 + influence * 0.45;
                context.stroke();
            });

            if (influence > 0.34) {
                connectedGroup.jointIndices.forEach(function (vertexIndex) {
                    const joint = transformed[vertexIndex];
                    context.beginPath();
                    context.arc(cube.x + joint.x, cube.y + joint.y, 0.7 + influence * 0.9, 0, Math.PI * 2);
                    context.fillStyle = "hsla(" + (hue + groupIndex * 4) + ", 100%, 84%, " + (0.2 + influence * 0.42) + ")";
                    context.fill();
                });
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

    function drawEdgeBody(body, influence, elapsed, repel, shockHighlight) {
        const points = rotatedEdgeBodyPoints(body, elapsed);
        const hue = (body.hue + influence * 145) % 360;
        const highlightStrength = clamp(shockHighlight / 0.3, 0, 1);

        body.connectedGroups.forEach(function (connectedGroup, groupIndex) {
            const transformed = transformConnectedEdges(
                points,
                connectedGroup,
                body.groupTraits[groupIndex],
                influence,
                body.segmentSize,
                body.seed + groupIndex * 1.91,
                repel
            );

            connectedGroup.edges.forEach(function (edge) {
                const first = transformed[edge[0]];
                const second = transformed[edge[1]];

                context.beginPath();
                context.moveTo(body.x + first.x, body.y + first.y);
                context.lineTo(body.x + second.x, body.y + second.y);
                const edgeHue = mix(hue + groupIndex * 7, 184, highlightStrength);
                context.strokeStyle = "hsla(" + edgeHue + ", 100%, " + (76 + highlightStrength * 20) + "%, " + (0.25 + body.depth * 0.34 + influence * 0.28 + highlightStrength * 0.16) + ")";
                context.lineWidth = 0.75 + body.depth * 0.95 + influence * 0.38;
                context.stroke();
            });

            connectedGroup.jointIndices.forEach(function (vertexIndex) {
                const joint = transformed[vertexIndex];
                context.beginPath();
                context.arc(body.x + joint.x, body.y + joint.y, 0.7 + body.depth * 0.75 + influence * 0.35, 0, Math.PI * 2);
                context.fillStyle = "hsla(" + (hue + groupIndex * 7) + ", 100%, 84%, " + (0.24 + body.depth * 0.25 + influence * 0.22) + ")";
                context.fill();
            });
        });
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

    function drawShockwaves() {
        shockwaves.forEach(function (wave) {
            const progress = clamp(wave.age / wave.duration, 0, 1);
            const visibility = Math.pow(1 - progress, 0.72);

            context.beginPath();
            context.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
            context.strokeStyle = "rgba(151, 239, 255, " + (0.2 * visibility) + ")";
            context.lineWidth = mix(3.2, 0.8, progress);
            context.stroke();

            if (wave.radius > 12) {
                context.beginPath();
                context.arc(wave.x, wave.y, Math.max(0, wave.radius - mix(18, 54, progress)), 0, Math.PI * 2);
                context.strokeStyle = "rgba(141, 115, 255, " + (0.08 * visibility) + ")";
                context.lineWidth = mix(7, 2, progress);
                context.stroke();
            }
        });
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

        pointer.smoothX += (pointer.x - pointer.smoothX) * 0.72;
        pointer.smoothY += (pointer.y - pointer.smoothY) * 0.72;
        pointer.strength += (pointer.targetStrength - pointer.strength) * 0.09;
        updateShockwaves(delta);

        context.clearRect(0, 0, width, height);
        context.save();
        context.globalCompositeOperation = "screen";
        context.lineCap = "round";
        context.lineJoin = "round";

        const influenceRadius = clamp(Math.min(width, height) * 0.32, 190, 330);
        drawPointerAtmosphere(influenceRadius);
        drawShockwaves();

        edgeBodies.forEach(function (body) {
            updateEdgeBody(body, delta, elapsed);
            const influence = influenceAt(body, influenceRadius, delta);
            drawEdgeBody(
                body,
                influence.amount,
                reducedMotion ? 0 : elapsed,
                { x: influence.repelX, y: influence.repelY },
                influence.shockAmount
            );
        });

        cubes.forEach(function (cube) {
            updateCube(cube, delta, elapsed);
            const influence = influenceAt(cube, influenceRadius, delta);
            const points = projectVertices(cube, reducedMotion ? 0 : elapsed);
            const repel = { x: influence.repelX, y: influence.repelY };
            drawFaces(cube, points, influence.amount, repel, influence.pointerAmount, influence.shockAmount);
            drawEdges(cube, points, influence.amount, repel, influence.shockAmount);
        });

        context.restore();
        frameId = window.requestAnimationFrame(render);
    }

    function setPointer(event) {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        pointer.targetStrength = 1;
    }

    function handlePointerDown(event) {
        setPointer(event);
        launchShockwave(event);
    }

    function startRendering() {
        if (renderingStarted) return;
        renderingStarted = true;
        resize();
        canvas.classList.add("is-visible");
        if (!document.hidden) {
            previousTime = performance.now();
            frameId = window.requestAnimationFrame(render);
        }
    }

    window.addEventListener("pointermove", setPointer, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
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
        } else if (renderingStarted && !frameId) {
            previousTime = performance.now();
            frameId = window.requestAnimationFrame(render);
        }
    });

    if (document.querySelector(".loader-wrapper")) {
        document.addEventListener("site:loader-hidden", startRendering, { once: true });
    } else {
        startRendering();
    }
}());
