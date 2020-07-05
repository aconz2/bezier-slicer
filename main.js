import * as THREE from './three.js/build/three.module.js';
// import {TrackballControls} from './three.js/examples/jsm/controls/TrackballControls.js';
import {OrbitControls} from './three.js/examples/jsm/controls/OrbitControls.js';
import {curveTo3At} from './util.js';
import {SVGPreview} from './svgPreview.js';
import {CurveEditor} from './curveEditor.js';

var camera, scene, renderer, controls;

var rotationEditor;
var scaleEditor;

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
    var append = (i) => {
        if (curves[i].type == 'CurvePath') {
            for (let c of curves[i].curves) {
                pieces.push(c);
            }
        } else {
            pieces.push(curves[i]);
        }
    };
    for (var i = 0; i < curves.length - 1; i++) {
        append(i);
        var end = curveEnd(curves[i]);
        var start = curveStart(curves[i + 1]);
        if (end.distanceToSquared(start) > distanceTolSquared) {
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
    append(curves.length - 1);

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

function rotateAndScalePoint(point, rotation, scale, origin) {
    var pointing = point.clone().sub(origin).setLength(point.distanceTo(origin) * scale);
    var scaled = origin.clone().add(pointing);
    return scaled.rotateAround(origin, rotation * Math.PI / 180);
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

function rotateAndScaleCurve(curve, rotation, scaling, origin) {
    let f = (pt) => rotateAndScalePoint(pt, rotation, scaling, origin);
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

function rotateAndScalePath(path, rotation, scale, origin) {
    origin = origin || medianPoint(path);
    var ret = new THREE.CurvePath();
    ret.curves = path.curves.map((x) => rotateAndScaleCurve(x, rotation, scale, origin));
    return ret;
}


function process(curve, steps, layerHeight, f) {
    var acc = [curveTo3At(curve, layerHeight)];
    for (var i = 1; i < steps; i++) {
        acc.push(curveTo3At(f(curve, acc[i - 1], i), layerHeight * (i + 1)));
    }
    return acc;
}

function circleShape(steps, diameter) {
    var pts = [];
    var r = diameter / 2;
    var theta = 2 * Math.PI / steps;
    for (var i = 0; i < steps; i++) {
        pts.push(new THREE.Vector2(r * Math.cos(i * theta), r * Math.sin(i * theta)));
    }
    pts.push(pts[0]);
    return new THREE.Shape(pts);
}

function spacePoints(points, min, max) {
    var diff = (max - min) / points.length;
    for (var i = 0; i < points.length; i++) {
        points[i].setZ(min + i * diff);
    }
}

function pointsToCurvePath(points) {
    var curves = [];
    // TODO this can use a curve geometry
    for (var i = 0; i < points.length - 1; i++) {
        curves.push(new THREE.LineCurve3(points[i], points[i + 1]));
    }
    var ret = new THREE.CurvePath();
    ret.curves = curves;
    return ret;
}

function init() {
    THREE.Object3D.DefaultUp = new THREE.Vector3(0,0,1);

    var divisionsEvery = 10;
    var buildPlate = 220;

    const width = 600;
    const height = 400;

	renderer = new THREE.WebGLRenderer();
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(width, height);
	document.querySelector('#preview').appendChild(renderer.domElement);

	scene = new THREE.Scene();
	scene.background = new THREE.Color(0x333333);

	camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
	camera.position.set(buildPlate, -buildPlate, buildPlate);

	controls = new OrbitControls(camera, renderer.domElement);

	scene.add(new THREE.AmbientLight(0x222222, 5));
	var light = new THREE.PointLight(0xffffff, 0.5);
	light.position.copy(camera.position);
	scene.add(light);

	// var planeGeometry = new THREE.PlaneBufferGeometry( 2000, 2000 );
	// planeGeometry.rotateX( - Math.PI / 2 );
	// var planeMaterial = new THREE.ShadowMaterial( { opacity: 0.2 } );
	// var plane = new THREE.Mesh( planeGeometry, planeMaterial );
	// plane.position.y = -1;
	// plane.receiveShadow = true;
	// scene.add( plane );

	var grid = new THREE.GridHelper(buildPlate, buildPlate / divisionsEvery);
	// grid.position.y = - 199;
	grid.rotateX(- Math.PI / 2 );
	grid.material.opacity = 0.25;
	grid.material.transparent = true;
	scene.add(grid);

    var axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    var extrudeProfile = circleShape(8, 1);
    console.log(extrudeProfile);

    var shape = circleShape(8, 100);

    var origin = medianPoint(shape);
    // var foo = process(shape, 100, 1, (c, _, i) => rotatePath(scalePath(c, 1 + i/100), i * 1));
    var layers = 10;
    var layerHeight = 1;
    var foo = process(shape, layers, layerHeight, (c, _, i) => rotateAndScalePath(c, i, 1 + i/200, origin));
    var path = concatCurves(foo);
    var points = path.getSpacedPoints(Math.floor(path.getLength()));
    spacePoints(points, layerHeight, (layers + 1) * layerHeight);
    var printReady = pointsToCurvePath(points);

    console.log(points);
    console.log(foo);
    console.log(path);
    console.log('hi');
    var stepsPerLength = 0.5;
	var extrudeSettings = {
		steps: Math.floor(path.getLength() * stepsPerLength),
		bevelEnabled: false,
		// extrudePath: path
		extrudePath: printReady
	};
	var geometry = new THREE.ExtrudeBufferGeometry(extrudeProfile, extrudeSettings);
	var material = new THREE.MeshLambertMaterial({ color: 0x2194ce, wireframe: false });
	var mesh = new THREE.Mesh(geometry, material);
    console.log(geometry);
    console.log(mesh);
    console.log(material);
	scene.add(mesh);

    rotationEditor = new CurveEditor(document.querySelector('#rotationCurves'), {yRange: [-360, 360]});
    scaleEditor = new CurveEditor(document.querySelector('#scaleCurves'), {yRange: [-5, 5]});
}

function animate() {
	requestAnimationFrame(animate);
	controls.update();
	renderer.render(scene, camera);
    rotationEditor.render();
    scaleEditor.render();
}
