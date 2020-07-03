import * as THREE from './three.js/build/three.module.js';
import { TrackballControls } from './three.js/examples/jsm/controls/TrackballControls.js';
var camera, scene, renderer, controls;

const distanceTol = 1e-6;
const distanceTolSquared = Math.pow(distanceTol, 2);

init();
animate();

function curveStart(curve) {
    if (curve.type === 'CatmullRomCurve3') return curve.points[0];
    if (curve.type === 'CubicBezierCurve3') return curve.v0;
    if (curve.type === 'CurvePath') return curveStart(curve.curves[0]);
    if (curve.type === 'LineCurve3') return curve.v1
    throw Error(`Unhandled curve ${curve.type}`);
}
function curveEnd(curve) {
    if (curve.type === 'CatmullRomCurve3') return curve.points[curve.points.length - 1];
    if (curve.type === 'CubicBezierCurve3') return curve.v3;
    if (curve.type === 'CurvePath') return curveEnd(curve.curves[curve.curves.length - 1]);
    if (curve.type === 'LineCurve3') return curve.v2
    throw Error(`Unhandled curve ${curve.type}`);
}

function medianPoint(curve, n) {
    n = n || 100;
    var points = curve.getSpacedPoints(n);
    var acc = points[0];
    for (var i = 0; i < points.length; i++) {
        acc.add(points[i]);
    }
    acc.divideScalar(n);
    return acc;
}

function concatCurves(curves, method) {
    method = method || 'line';
    var pieces = [];
    for (var i = 0; i < curves.length - 1; i++) {
        if (curves[i].type == 'CurvePath') {
            for (let c of curves[i].curves) {
                pieces.push(c);
            }
        } else {
            pieces.push(curves[i]);
        }
        var end = curveEnd(curves[i]);
        var start = curveStart(curves[i + 1]);
        if (end.distanceToSquared(start) > distanceTolSquared) {
            // TODO: this is just a line I think with two points,
            // What I really want is to use 2 more points, one on either curve
            // and then crop the smoothed curve to start and end
            if (method == 'line') {
                pieces.push(new THREE.LineCurve3(end, start));
            } else if (method == 'bezier') {
                let control1 = curves[i].getTangent(1).add(end);
                let control2 = curves[i + 1].getTangent(0).add(start);
                pieces.push(new THREE.CubicBezierCurve3(end, control1, control2, start));
            } else {
                throw Error(`Unhandled method ${method}`)
            }
        }
    }
    pieces.push(curves[curves.length - 1]);
    var ret = new THREE.CurvePath();
    ret.curves = pieces;
    return ret;
}

function scalePoint(point, amount, origin) {
    var pointing = point.clone().sub(origin).setLength(point.distanceTo(origin) * amount);
    return origin.clone().add(pointing);
}

function rotatePoint(point, amount, origin) {
    return point.clone().rotateAround(origin, amount * Math.PI / 180);
}

function scaleCurve(curve, amount, origin) {
    let f = (pt) => scalePoint(pt, amount, origin);
    let c = curve;
    if (c.type === 'LineCurve') return new THREE.LineCurve(f(c.v1), f(c.v2));
    throw Error(`Unhandled curve ${curve.type}`);
}

function rotateCurve(curve, amount, origin) {
    let f = (pt) => rotatePoint(pt, amount, origin);
    let c = curve;
    if (c.type === 'LineCurve') return new THREE.LineCurve(f(c.v1), f(c.v2));
    throw Error(`Unhandled curve ${curve.type}`);
}

// meant to be used only with 2d
function scalePath(path, amount, origin) {
    origin = origin || medianPoint(path);
    var ret = new THREE.CurvePath();
    ret.curves = path.curves.map((x) => scaleCurve(x, amount, origin));
    return ret;
}

function rotatePath(path, amount, origin) {
    origin = origin || medianPoint(path);
    var ret = new THREE.CurvePath();
    ret.curves = path.curves.map((x) => rotateCurve(x, amount, origin));
    return ret;
}

function vector2to3(v2, z) {
    return new THREE.Vector3(v2.x, v2.y, z);
}

function curveTo3At(curve, height) {
    let f = (v) => vector2to3(v, height);
    let c = curve;
    if (c.type === 'CubicBezierCurve') return new THREE.CubicBezierCurve3(f(c.v0), f(c.v1), f(c.v2), f(c.v3));
    if (c.type === 'Shape' || c.type === 'CurvePath') {
        var ret = new THREE.CurvePath();
        ret.curves = c.curves.map((x) => curveTo3At(x, height));
        return ret;
    }
    if (c.type === 'LineCurve') return new THREE.LineCurve3(f(c.v1), f(c.v2)); // why does this use v1 and v2 and not v0 and v1 ??????
    throw new Error(`Unhandled curve type ${curve.type}`)
}

function process(curve, steps, layerHeight, f) {
    var acc = [curveTo3At(curve, layerHeight)];
    for (var i = 1; i < steps; i++) {
        acc.push(curveTo3At(f(curve, acc[i - 1], i), layerHeight * (i + 1)));
    }
    return acc;
}

function init() {
	renderer = new THREE.WebGLRenderer();
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	document.body.appendChild(renderer.domElement);

	scene = new THREE.Scene();
	scene.background = new THREE.Color(0x222222);

	camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
	camera.position.set(0, 0, 500);

	controls = new TrackballControls(camera, renderer.domElement);
	controls.minDistance = 200;
	controls.maxDistance = 500;

	scene.add(new THREE.AmbientLight(0x222222));
	var light = new THREE.PointLight(0xffffff);
	light.position.copy(camera.position);
	scene.add(light);

	var extrudeProfile = new THREE.Shape([
        new THREE.Vector2(0, 0),
        new THREE.Vector2(5, 0),
        new THREE.Vector2(5, 5),
        new THREE.Vector2(0, 5),
    ]);

    var shape = new THREE.Shape([
        new THREE.Vector2(0, 0),
        new THREE.Vector2(100, 0),
        new THREE.Vector2(100, 100),
        new THREE.Vector2(0, 100),
        new THREE.Vector2(0, 0),
    ]);

    var foo = process(shape, 5, 20, (c, _, i) => rotatePath(scalePath(c, 1 + i/10), i * 10));
    var path = concatCurves(foo);
    // var path = curveTo3At(shape, 0);
	var extrudeSettings = {
		steps: path.getLength(),
		bevelEnabled: false,
		extrudePath: path
	};
	var geometry = new THREE.ExtrudeBufferGeometry(extrudeProfile, extrudeSettings);
	var material = new THREE.MeshLambertMaterial({ color: 0xb00000, wireframe: false });
	var mesh = new THREE.Mesh(geometry, material);
	scene.add(mesh);
}

function animate() {
	requestAnimationFrame(animate);
	controls.update();
	renderer.render(scene, camera);
}
