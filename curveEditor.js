import * as THREE from './three.js/build/three.module.js';
import {vector3to2} from './util.js';

function label(text, style) {
    style = style || {};
    let ret = document.createElement('span');
    ret.innerText = text;
    for (let k in style) {
        ret.style[k] = style[k];
    }
    return ret;
}

function circlePoints(steps, diameter) {
    var pts = [];
    var r = diameter / 2;
    var theta = 2 * Math.PI / steps;
    for (var i = 0; i < steps; i++) {
        pts.push(new THREE.Vector3(r * Math.cos(i * theta), r * Math.sin(i * theta), 0));
    }
    return pts;
}

function curvePathLinePoints(path) {
    var ret = [];
    let curves = path.curves;
    for (let line of curves) ret.push(line.v1);
    ret.push(curves[curves.length - 1].v2);
    return ret;
}

export function CurveEditor(container, opt) {
    opt = opt || {};
    this.container = container;

    const circleSize = opt.circleSize || 5;
    const circleColor = opt.circleColor || 0xffff00;
    const curveColor = opt.circleColor || 0xff0000;
    const divisions = opt.divisions || 10;
    const width = opt.width || 400;
    const height = opt.height || 200;
    const gridSize =  Math.max(width, height);
    const pointsPerLength = 0.25;
    const closed = opt.closed || false;
    const showAxis = opt.showAxis || false;

    const top    =  height / 2;
    const bottom = -height / 2;
    const right  =  width / 2;
    const left   = -width / 2;

    this.lines = opt.lines || false;

    let yRange = opt.yRange || [-1, 1];
    this.minY = yRange[0];
    this.maxY = yRange[1];

    this.curve = null;
    this.circles = [];

    const baseLine = THREE.MathUtils.mapLinear(opt.baseLine || 0, yRange[0], yRange[1], bottom, top);

    this.onChange = opt.onChange || (() => {});

    this.container.style.position = 'relative';
    this.minYLabel = label(`${this.minY}`, {'pointer-events': 'none', 'color': 'white', 'position': 'absolute', 'bottom': '10px'});
    this.maxYLabel = label(`${this.maxY}`, {'pointer-events': 'none', 'color': 'white', 'position': 'absolute'});
    this.container.appendChild(this.minYLabel);
    this.container.appendChild(this.maxYLabel);

	this.renderer = new THREE.WebGLRenderer({antialias: true});
	this.renderer.setPixelRatio(window.devicePixelRatio);
	this.renderer.setSize(width, height);
    this.canvas = this.renderer.domElement
	this.container.appendChild(this.canvas);

	this.scene = new THREE.Scene();
	this.scene.background = new THREE.Color(0x333333);

    this.camera = new THREE.OrthographicCamera(left, right, top, bottom);
    this.camera.position.set(0, 0, 10);

	let grid = new THREE.GridHelper(gridSize, gridSize / divisions);
    grid.position.y = -1;
	grid.rotateX(-Math.PI / 2);
	grid.material.opacity = 0.25;
	grid.material.transparent = true;
    this.scene.add(grid);

    if (showAxis) {
        let material = new THREE.LineDashedMaterial({
	        color: 0xffffff,
	        linewidth: 1,
	        dashSize: 2,
	        gapSize: 5,
        });
        let geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(left, baseLine, 0),
            new THREE.Vector3(right, baseLine, 0),
        ])
        let line = new THREE.Line(geometry, material);
        line.computeLineDistances();
        this.scene.add(line);
    }

    this.circleMaterial = new THREE.MeshBasicMaterial({color: circleColor});

    this.addCircle = (point) => {
        console.log('addcircle')
        let circle = new THREE.Mesh(new THREE.CircleGeometry(circleSize, 32), this.circleMaterial);
        console.log(point)
        circle.position.copy(point);
        this.scene.add(circle);
        return circle;
    };

    this.setCurve = (curve) => {
        console.log('setCurve')
        this.cachedPoints = null;
        for (let c of this.circles) {
            this.scene.remove(c);
        }
        this.curve = curve;
        this.circles = this.curve.points.map(this.addCircle);
        this.updateCurve();
        this.onChange();
    };

    this.pointerCircle = new THREE.Mesh(new THREE.CircleGeometry(2, 32), new THREE.MeshBasicMaterial({color: 0x00ff00}));
    this.scene.add(this.pointerCircle);
    this.pointerCircle.visible = false;

    this.curveGeometry = new THREE.BufferGeometry();
    this.curveMaterial = new THREE.LineBasicMaterial({color: curveColor});
    this.curveObject = new THREE.Line(this.curveGeometry, this.curveMaterial);
    this.scene.add(this.curveObject);

    this.updateCurve = () => {
        this.cachedPoints = null;
        if (this.lines) {
            let pts = this.curve.points.slice(0);
            pts.push(pts[0]);
            this.curveGeometry.setFromPoints(pts);
        } else {
            let nPoints = Math.floor(this.curve.getLength() * pointsPerLength);
            this.curveGeometry.setFromPoints(this.curve.getPoints(nPoints));
        }
    };

    this.dragging = null;

    const distanceThreshold = circleSize * 2;

    this.mouseVector = new THREE.Vector3();
    const mouseOffsetX = (width / 2);
    const mouseOffsetY = (height / 2);
    console.log(height)
    console.log(mouseOffsetY)
    this.setMouseVector = (event) => {
        // what a nightmare
        // this.mouseVector.x = event.pageX - this.container.offsetLeft - mouseOffsetX;
        // this.mouseVector.y = height - (event.pageY - this.container.offsetTop) - mouseOffsetY;

        this.mouseVector.x = event.pageX - this.canvas.offsetLeft;
        this.mouseVector.y = height - (event.pageY - this.canvas.offsetTop);
        console.log(this.mouseVector)
    };

    this.getClosestCircle = (event) => {
        this.setMouseVector(event);
        console.log(this.mouseVector);
        for (var i = 0; i < this.circles.length; i++) {
            if (this.circles[i].position.distanceTo(this.mouseVector) < distanceThreshold) {
                return i;
            }
        }
        return null;
    };

    this.container.onmouseclick = (event) => {
        event.preventDefault();
        if (event.buttons === 2) { // right click
            let i = this.getClosestCircle(event);
            if (i !== null && (
                (!closed && i != 0 && i != this.circles.length - 1) ||
                (closed && this.circles.length > 3)
            )) {
                this.scene.remove(this.circles[i]);
                this.circles.splice(i, 1);
                this.curve.points.splice(i, 1);
                this.updateCurve();
                this.onChange();
            }
        }
    };

    this.container.ondblclick = (event) => {
        event.preventDefault();
        this.setMouseVector(event);
        if (closed) {
            // argmin
            let line = new THREE.Line3();
            let closest = new THREE.Vector3();
            let [i, distance] = this.curve.points.reduce((acc, cur, i, points) => {
                let j = (i + 1) % points.length;
                line.set(points[i], points[j]);
                line.closestPointToPoint(this.mouseVector, true, closest);
                let distance = closest.distanceTo(this.mouseVector);
                if (distance < acc[1]) return [i, distance];
                return acc;
            }, [-1, 1e9]);
            this.curve.points.splice(i + 1, 0, this.mouseVector.clone());
            this.circles.splice(i + 1, 0, this.addCircle(this.mouseVector.clone()));
        } else {
            // TODO: we could find the insertion point (by binary search too by X) or just insert it and then sort...
            this.curve.points.push(this.mouseVector.clone());
            this.circles.push(this.addCircle(this.mouseVector.clone()));
            this.curve.points.sort((a, b) => a.x - b.x);
            this.circles.sort((a, b) => a.position.x - b.position.x);
        }
        this.updateCurve();
        this.onChange();
    };

    this.container.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        this.container.onmouseclick(event);
    }, false);

    this.container.onmousedown = (event) => {
        event.preventDefault();
        if (event.buttons === 1) { // left click
            this.dragging = this.getClosestCircle(event);
            // console.log(`Now dragging ${this.dragging}`)
        }
    };

    this.container.onmouseup = (event) => {
        event.preventDefault();
        this.dragging = null;
    };

    this.container.onmousemove = (event) => {
        event.preventDefault();
        if (this.dragging !== null) {
            // console.log(`mousemove ${this.dragging}`)
            this.setMouseVector(event);
            if (!closed && this.dragging === 0) {
                this.mouseVector.setX(left);
            } else if (!closed && this.dragging === this.circles.length - 1) {
                this.mouseVector.setX(right);
            }
            this.circles[this.dragging].position.copy(this.mouseVector);
            this.curve.points[this.dragging].copy(this.mouseVector);
            // console.log(this.mouseVector)
            this.updateCurve();
            this.onChange();
        } else {
            let i = this.getClosestCircle(event);
        console.log(i)
            this.pointerCircle.position.copy(this.mouseVector);
            // console.log(this.mouseVector)
            if (i === null) {
                this.container.style.cursor = 'default';
            } else {
                this.container.style.cursor = 'move';
            }
        }
    };

    this.render = () => {
	    this.renderer.render(this.scene, this.camera);
    };

    this.cachedPoints = null;
    this.nCachedPoints = -1;

    this.getPoints = (n) => {
        if (this.cachedPoints !== null && n === this.nCachedPoints) return this.cachedPoints;
        this.cachedPoints = this.curve.getSpacedPoints(n - 1).map(p => THREE.MathUtils.mapLinear(p.y, bottom, top, this.minY, this.maxY))
        this.nCachedPoints = n;
        return this.cachedPoints;
    };

    this.setLines = (lines) => {
        this.lines = lines;
        this.cachedPoints = null;
        this.updateCurve();
        this.onChange();
    }

    this.getCurve = () => {
        if (closed && this.lines) {
            let ret = new THREE.CurvePath();
            let points = this.curve.points;
            for (var i = 0; i < points.length; i++) {
                ret.curves.push(new THREE.LineCurve3(points[i], points[(i + 1) % points.length]));
            }
            return ret;
        } else {
            return this.curve;
        }
    };

    if (closed) {
        let c = new THREE.CatmullRomCurve3(circlePoints(3, Math.min(width, height) * 0.6));
        // let offset = new THREE.Vector3(width / 2, height / 2, 0);
        // for (let p of c.points) p.add(offset);
        c.closed = true;
        this.setCurve(c);
    } else {
        this.setCurve(new THREE.CatmullRomCurve3( [
	        new THREE.Vector3(left, baseLine, 0),
	        new THREE.Vector3(0, baseLine, 0),
	        new THREE.Vector3(right, baseLine, 0),
        ]));
    }
}
