import * as THREE from './three.js/build/three.module.js';
// import {TrackballControls} from './three.js/examples/jsm/controls/TrackballControls.js';
import {OrbitControls} from './three.js/examples/jsm/controls/OrbitControls.js';
import {SVGPreview} from './svgPreview.js';
import {CurveEditor} from './curveEditor.js';
import {ChooseDrawing} from './chooseDrawing.js';
import {colorGradient, colorGradientToCenter, debounce, curveTo3At, vector2to3, vector3to2} from './util.js';

const distanceTol = 1e-6;
const distanceTolSquared = Math.pow(distanceTol, 2);
const debounceAmount = 100;

function partial(f, x) {
    return f.bind(undefined, x);
}

function curveStart(curve) {
    if (curve.type === 'CatmullRomCurve3') return curve.points[0];
    if (curve.type === 'CubicBezierCurve3') return curve.v0;
    if (curve.type === 'CurvePath') return curveStart(curve.curves[0]);
    if (curve.type === 'LineCurve') return curve.v1
    if (curve.type === 'LineCurve3') return curve.v1
    throw Error(`Unhandled curve ${curve.type}`);
}
function curveEnd(curve) {
    if (curve.type === 'CatmullRomCurve3') {
        if (curve.closed) return curve.points[0];
        else return curve.points[curve.points.length - 1];
    }
    if (curve.type === 'CubicBezierCurve3') return curve.v3;
    if (curve.type === 'CurvePath') return curveEnd(curve.curves[curve.curves.length - 1]);
    if (curve.type === 'LineCurve') return curve.v2
    if (curve.type === 'LineCurve3') return curve.v2
    throw Error(`Unhandled curve ${curve.type}`);
}

function medianPoint(curve, n) {
    n = n || 100;
    let points = curve.getSpacedPoints(n);
    let acc = points[0];
    for (let i = 0; i < points.length; i++) {
        acc.add(points[i]);
    }
    acc.divideScalar(n);
    return acc;
}

function concatCurves(curves, method) {
    method = method || 'line';
    let pieces = [];
    let append = (i) => {
        if (curves[i].type == 'CurvePath') {
            for (let c of curves[i].curves) {
                pieces.push(c);
            }
        } else {
            pieces.push(curves[i]);
        }
    };
    let inserted = 0;
    for (let i = 0; i < curves.length - 1; i++) {
        append(i);
        let end = curveEnd(curves[i]);
        let start = curveStart(curves[i + 1]);
        if (end.distanceToSquared(start) > distanceTolSquared) {
            inserted += 1;
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
    console.log(`Inserted ${inserted} connecting lines`);

    let ret = new THREE.CurvePath();
    ret.curves = pieces;
    return ret;
}

// function scalePoint(point, amount, origin) {
//     let pointing = point.clone().sub(origin).setLength(point.distanceTo(origin) * amount);
//     return origin.clone().add(pointing);
// }

// function rotatePoint(point, amount, origin) {
//     return point.clone().rotateAround(origin, amount * Math.PI / 180);
// }

function rotateAndScalePoint(point, rotation, scale, origin, prevPoint, clampDistance) {
    let pointing = point.clone().sub(origin).setLength(point.distanceTo(origin) * scale);
    let scaled = origin.clone().add(pointing);
    let ret = scaled.rotateAround(origin, rotation * Math.PI / 180);
    if (clampDistance === null || clampDistance === undefined) {
        return ret;
    }
    let direction = ret.sub(prevPoint).clampLength(0, clampDistance);
    return prevPoint.clone().add(direction);
}

// function scaleCurve(curve, amount, origin) {
//     let f = (pt) => scalePoint(pt, amount, origin);
//     let c = curve;
//     if (c.type === 'LineCurve') return new THREE.LineCurve(f(c.v1), f(c.v2));
//     throw Error(`Unhandled curve ${curve.type}`);
// }

// function rotateCurve(curve, amount, origin) {
//     let f = (pt) => rotatePoint(pt, amount, origin);
//     let c = curve;
//     if (c.type === 'LineCurve') return new THREE.LineCurve(f(c.v1), f(c.v2));
//     throw Error(`Unhandled curve ${curve.type}`);
// }

function apply232(f, v) {
    return vector2to3(f(vector3to2(v)), v.z);
}

function rotateAndScaleCurve(curve, rotation, scaling, origin, prevCurve, clampDistance) {
    // TODO allow clamping the point to a maxDistance
    let f = (k) => rotateAndScalePoint(curve[k], rotation, scaling, origin, prevCurve[k], clampDistance);
    if (c.type === 'LineCurve') return new THREE.LineCurve(f('v1'), f('v2'));
    if (c.type === 'LineCurve3') return new THREE.LineCurve(apply232(f, partial(f, 'v1')), apply232(f, partial(f, 'v2')));
    throw Error(`Unhandled curve ${curve.type}`);
}

// meant to be used only with 2d
// function scalePath(path, amount, origin) {
//     origin = origin || medianPoint(path);
//     let ret = new THREE.CurvePath();
//     ret.curves = path.curves.map((x) => scaleCurve(x, amount, origin));
//     return ret;
// }

// function rotatePath(path, amount, origin) {
//     origin = origin || medianPoint(path);
//     let ret = new THREE.CurvePath();
//     ret.curves = path.curves.map((x) => rotateCurve(x, amount, origin));
//     return ret;
// }

function rotateAndScalePath(path, rotation, scale, origin, prevPath, clampDistance) {
    origin = origin || medianPoint(path);
    if (path.type === 'CatmullRomCurve3') {
        let points = path.points.map((x, i) => apply232((y) => rotateAndScalePoint(y, rotation, scale, origin, prevPath.points[i], clampDistance), x));
        let ret = new THREE.CatmullRomCurve3(points);
        ret.closed = path.closed;
        return ret;
    } else {
        let ret = new THREE.CurvePath();
        ret.curves = path.curves.map((x, i) => rotateAndScaleCurve(x, rotation, scale, origin, prevPath.curves[i], clampDistance));
        return ret;
    }
}

function process(curve, steps, layerHeight, f) {
    let acc = [curve];
    for (let i = 1; i < steps; i++) {
        acc.push(curveTo3At(f(curve, acc, i), layerHeight * (i + 1)));
    }
    return acc;
}

function circleShape(steps, diameter) {
    let pts = [];
    let r = diameter / 2;
    let theta = 2 * Math.PI / steps;
    for (let i = 0; i < steps; i++) {
        pts.push(new THREE.Vector2(r * Math.cos(i * theta), r * Math.sin(i * theta)));
    }
    pts.push(pts[0]);
    return new THREE.Shape(pts);
}

function spacePoints(points, min, max) {
    let diff = (max - min) / points.length;
    for (let i = 0; i < points.length; i++) {
        points[i].setZ(min + i * diff);
    }
}

function pointsToCurvePath(points) {
    let curves = [];
    // TODO this can use a curve geometry
    for (let i = 0; i < points.length - 1; i++) {
        curves.push(new THREE.LineCurve3(points[i], points[i + 1]));
    }
    let ret = new THREE.CurvePath();
    ret.curves = curves;
    return ret;
}

function formatBoundingBox(bbox) {
    let w = bbox.max.x - bbox.min.x;
    let l = bbox.max.y - bbox.min.y;
    let h = bbox.max.z - bbox.min.z;
    let f = (x) => x.toFixed(2);
    return `${f(w)} x ${f(l)} x ${f(h)} | (${f(bbox.min.x)} — ${f(bbox.max.x)}, ${f(bbox.min.y)} — ${f(bbox.max.y)}, ${f(bbox.min.z)} — ${f(bbox.max.z)})`;
}

function Main() {
    THREE.Object3D.DefaultUp = new THREE.Vector3(0,0,1);

    let divisionsEvery = 10;
    let buildPlate = 220;

    const width = 600;
    const height = 400;

    this.layers = 100;
    this.layerHeight = 0.2;
    this.pointsPerLength = 1;
    this.previewPointsPerLength = 0.1;
    this.curve = null;
    this.clampDistance = this.layerHeight * 2;
    this.clampDistanceEnabled = false;

    this.previewRainbow = true;
    this.previewRainbowType = 'distance';
    this.previewExtrude = false;
    this.extrudeProfile = circleShape(8, this.layerHeight);
    this.extrudedObject = null;
    const previewColor = 0x2194ce
	this.extrudedMaterial = new THREE.MeshLambertMaterial({color: previewColor, wireframe: false});
	this.lineMaterial = new THREE.LineBasicMaterial({color: previewColor, linewidth: 2, opacity: 0.5, transparent: true});

    this.boundingBoxElement = document.querySelector('#boundingBox');
    this.nLayersElement = document.querySelector('input[name="nLayers"]');
    this.layerHeightElement = document.querySelector('input[name="layerHeight"]');
    this.previewRainbowElement = document.querySelector('input[name="previewRainbow"]');
    // this.previewRainbowTypeElement = document.querySelector('input[name="previewRainbowType"]');
    this.previewExtrudeElement = document.querySelector('input[name="previewExtrude"]');
    this.clampDistanceEnabledElement = document.querySelector('input[name="clampDistanceEnabled"]');
    this.clampDistanceElement = document.querySelector('input[name="clampDistance"]');

    this.previewRainbowElement.checked = this.previewRainbow;
    this.clampDistanceEnabledElement.checked = this.clampDistanceEnabled;
    this.clampDistanceElement.value = this.clampDistance;
    this.nLayersElement.value = this.layers;
    this.layerHeightElement.value = this.layerHeight;

	let renderer = this.renderer = new THREE.WebGLRenderer({antialias: true});
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(width, height);
	document.querySelector('#preview').appendChild(renderer.domElement);

	let scene = this.scene = new THREE.Scene();
	scene.background = new THREE.Color(0x333333);

	let camera = this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
	camera.position.set(buildPlate, -buildPlate, buildPlate);

	let controls = this.controls = new OrbitControls(camera, renderer.domElement);

	scene.add(new THREE.AmbientLight(0x222222, 5));
	let light = new THREE.PointLight(0xffffff, 0.5);
	light.position.copy(camera.position);
	scene.add(light);

	let grid = new THREE.GridHelper(buildPlate, buildPlate / divisionsEvery);
	grid.rotateX(- Math.PI / 2 );
	grid.material.opacity = 0.25;
	grid.material.transparent = true;
	scene.add(grid);
    scene.add(new THREE.AxesHelper(5));

    this.pointsGeometry = new THREE.BufferGeometry();
    this.computeBoundingBox = (points) => {
        this.pointsGeometry.setFromPoints(points);
        this.pointsGeometry.computeBoundingBox();
        return this.pointsGeometry.boundingBox;
    }
    this.lineGeometry = new THREE.BufferGeometry();

    this.update = (curve) => {
        if (curve) {
            this.curve = curve;
        } else {
            if (this.curve === null) throw Error('Dont have a curve yet');
            curve = this.curve;
        }
        console.time('recomputeTotal');
        // console.log(curve)
        let origin = vector3to2(medianPoint(curve));
        let rotationAmounts = this.rotationEditor.getPoints(this.layers);
        let scaleAmounts = this.scaleEditor.getPoints(this.layers);

        let clampDistance = this.clampDistanceEnabled ? this.clampDistance : null;
        let f = (c, acc, i) => rotateAndScalePath(c, rotationAmounts[i], scaleAmounts[i], origin, acc[i - 1], clampDistance);
        console.time('processAndConcat');
        let path = concatCurves(process(curve, this.layers, this.layerHeight, f));
        console.timeEnd('processAndConcat');
        console.log(path);
        console.log(`Path length ${path.getLength().toFixed(2)}`)

        // TODO this can be simplified by only generating two points for a line if its longer than the min step length
        console.time('covertToLines');
        let points = path.getSpacedPoints(Math.floor(path.getLength() * this.pointsPerLength));
        spacePoints(points, this.layerHeight, (this.layers + 1) * this.layerHeight);
        console.timeEnd('covertToLines');

        this.boundingBoxElement.innerText = formatBoundingBox(this.computeBoundingBox(points));

        if (this.extrudedObject) scene.remove(this.extrudedObject);
        if (this.previewExtrude) {
	        let extrudeSettings = {
		        steps: Math.floor(path.getLength() * this.previewPointsPerLength),
		        bevelEnabled: false,
		        extrudePath: pointsToCurvePath(points)
	        };
            if (this.extrudedObject) scene.remove(this.extrudedObject);
            console.time('extrude');
	        let geometry = new THREE.ExtrudeBufferGeometry(this.extrudeProfile, extrudeSettings);
            console.timeEnd('extrude');
	        this.extrudedObject = new THREE.Mesh(geometry, this.extrudedMaterial);
        } else {
            this.lineGeometry.setFromPoints(points);
            // this.extrudedObject.castShadow = true;
            // this.extrudedObject.receiveShadow = true;
            console.log(this.lineMaterial.colors)
            if (this.previewRainbow) {
                let material = new THREE.LineBasicMaterial({vertexColors: THREE.VertexColors});
                // this.lineMaterial.vertexColors = true;
                // this.lineGeometry.colors = colorGradient(points.length);
                // this.lineGeometry.colorsNeedUpdate = true;
                if (this.previewRainbowType === 'distance') {
                    this.lineGeometry.setAttribute('color', new THREE.BufferAttribute(colorGradientToCenter(points, 0.2), 3));
                } else {
                    this.lineGeometry.setAttribute('color', new THREE.BufferAttribute(colorGradient(points, 0.0001), 3));
                }
                this.extrudedObject = new THREE.Line(this.lineGeometry, material);
            } else {
                this.lineMaterial.vertexColors = false;
                // this.lineGeometry.colorsNeedUpdate = true;
                this.extrudedObject = new THREE.Line(this.lineGeometry, this.lineMaterial);
            }
        }
        scene.add(this.extrudedObject);

        console.timeEnd('recomputeTotal');
    };

    this.updateDebounce = debounce(this.update, debounceAmount);

    let rotationEditor = this.rotationEditor = new CurveEditor(document.querySelector('#rotationCurves'), {yRange: [-90, 90], showAxis: true});
    let scaleEditor = this.scaleEditor = new CurveEditor(document.querySelector('#scaleCurves'), {yRange: [0.5, 1.5], baseLine: 1, showAxis: true});
    let chooseDrawing = this.chooseDrawing = new ChooseDrawing(() => {}, {size: buildPlate});

    chooseDrawing.onChange = this.updateDebounce;
    scaleEditor.onChange = this.updateDebounce;
    rotationEditor.onChange = this.updateDebounce;

    this.update(chooseDrawing.getCurve());

    this.nLayersElement.oninput = (event) => {
        this.layers = Number.parseInt(event.target.value);
        this.updateDebounce();
    };
    this.layerHeightElement.oninput = (event) => {
        this.layerHeight = Number.parseFloat(event.target.value);
        this.updateDebounce();
    };
    this.previewExtrudeElement.onchange = (event) => {
        this.previewExtrude = event.target.checked;
        this.updateDebounce();
    };
    this.clampDistanceEnabledElement.onchange = (event) => {
        this.clampDistanceEnabled = event.target.checked;
        this.updateDebounce();
    };
    this.clampDistanceElement.oninput = (event) => {
        this.clampDistance = Number.parseFloat(event.target.value);
        this.updateDebounce();
    };
    this.previewRainbowElement.oninput = (event) => {
        this.previewRainbow = event.target.checked;
        this.updateDebounce();
    };
    for (let el of document.querySelectorAll('input[name="previewRainbowType"]')) {
        el.onchange = (event) => {
            console.log(event)
            this.previewRainbowType = event.target.value;
            this.updateDebounce();
        };
    }

    this.animate = () => {
	    requestAnimationFrame(this.animate);
	    controls.update();
	    renderer.render(this.scene, this.camera);
        rotationEditor.render();
        scaleEditor.render();
        chooseDrawing.render();
    };
}

let main = new Main();
main.animate()
