import * as THREE from './three.js/build/three.module.js';

// var camera, scene, renderer;

// var geometry;
// var circle;

// var left, right, top, bottom;
var curveEditor1;
var curveEditor2;

init();
animate();

function CurveEditor(container, opt) {
    opt = opt || {};
    this.container = container;

    const circleSize = opt.circleSize || 5;
    const circleColor = opt.circleColor || 0xffff00;
    const curveColor = opt.circleColor || 0xff0000;
    const divisions = opt.divisions || 10;
    const width = opt.width || 400;
    const height = opt.height || 200;
    const gridSize =  Math.max(width, height);
    const nPoints = 50;

    const top    =  height / 2;
    const bottom = -height / 2;
    const right  =  width / 2;
    const left   = -width / 2;

	this.renderer = new THREE.WebGLRenderer();
	this.renderer.setPixelRatio(window.devicePixelRatio);
	this.renderer.setSize(width, height);
	this.container.appendChild(this.renderer.domElement);

	this.scene = new THREE.Scene();
	this.scene.background = new THREE.Color(0x333333);

	// this.scene.add(new THREE.AmbientLight(0x222222, 5));

    this.camera = new THREE.OrthographicCamera(left, right, top, bottom);
    this.camera.position.set(0, 0, 1);


	let grid = new THREE.GridHelper(gridSize, gridSize / divisions);
    grid.position.y = -1;
	grid.rotateX(- Math.PI / 2 );
	grid.material.opacity = 0.25;
	grid.material.transparent = true;
    this.scene.add(grid);

    this.circleMaterial = new THREE.MeshBasicMaterial({color: circleColor});

    this.addCircle = (point) => {
        let circle = new THREE.Mesh(new THREE.CircleGeometry(circleSize, 32), this.circleMaterial);
        circle.position.copy(point);
        this.scene.add(circle);
        return circle;
    };

    this.curve = new THREE.CatmullRomCurve3( [
	    new THREE.Vector3(left, 0, 0),
	    new THREE.Vector3(0, 0, 0),
	    new THREE.Vector3(right, 0, 0),
    ]);
    this.curveGeometry = new THREE.BufferGeometry();

    this.updateCurve = () => {
        this.curveGeometry.setFromPoints(this.curve.getPoints(nPoints));
    };

    this.circles = this.curve.points.map(this.addCircle);

    this.pointerCircle = new THREE.Mesh(new THREE.CircleGeometry(2, 32), new THREE.MeshBasicMaterial({color: 0x00ff00}));
    this.scene.add(this.pointerCircle);

    this.curveMaterial = new THREE.LineBasicMaterial({color: curveColor});
    this.curveObject = new THREE.Line(this.curveGeometry, this.curveMaterial);
    this.scene.add(this.curveObject);

    this.updateCurve();

    this.dragging = null;

    const distanceThreshold = 10;

    this.mouseVector = new THREE.Vector3();
    const mouseOffsetX = (width / 2);
    const mouseOffsetY = (height / 2);
    this.setMouseVector = (event) => {
        // what a nightmare
        this.mouseVector.x = event.pageX - event.target.offsetLeft - mouseOffsetX;
        this.mouseVector.y = height - (event.pageY - event.target.offsetTop) - mouseOffsetY;
    };

    // TODO we could binary search by X
    this.getClosestCircle = (event) => {
        this.setMouseVector(event);
        for (var i = 0; i < this.circles.length; i++) {
            if (this.circles[i].position.distanceTo(this.mouseVector) < distanceThreshold) {
                return i;
            }
        }
        return null;
    };

    this.container.onmouseclick = (event) => {
        event.stopPropagation();
        event.preventDefault();
        if (event.buttons === 2) { // right click
            let i = this.getClosestCircle(event);
            if (i !== null && i != 0 && i != this.circles.length - 1) {
                this.scene.remove(this.circles[i]);
                this.circles.splice(i, 1);
                this.curve.points.splice(i, 1);
                this.updateCurve();
            }
        }
    };

    this.container.ondblclick = (event) => {
        this.setMouseVector(event);
        // TODO: we could find the insertion point (by binary search too by X) or just insert it and then sort...
        this.curve.points.push(this.mouseVector.clone());
        this.circles.push(this.addCircle(this.mouseVector.clone()));
        this.curve.points.sort((a, b) => a.x - b.x);
        this.circles.sort((a, b) => a.position.x - b.position.x);
        this.updateCurve();
    };

    this.container.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        this.container.onmouseclick(event);
    }, false);

    this.container.onmousedown = (event) => {
        if (event.buttons === 1) { // left click
            this.dragging = this.getClosestCircle(event);
        }
    };

    this.container.onmouseup = (event) => {
        this.dragging = null;
    };

    this.container.onmousemove = (event) => {
        if (this.dragging !== null) {
            this.setMouseVector(event);
            if (this.dragging === 0) {
                this.mouseVector.setX(left);
            } else if (this.dragging === this.circles.length - 1) {
                this.mouseVector.setX(right);
            }
            this.circles[this.dragging].position.copy(this.mouseVector);
            this.curve.points[this.dragging].copy(this.mouseVector);
            this.updateCurve();
        } else {
            let i = this.getClosestCircle(event);
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

}

function init() {
    THREE.Object3D.DefaultUp = new THREE.Vector3(0,0,1);

    var editorNode1 = document.querySelector('#editor1');
    var editorNode2 = document.querySelector('#editor2');

    curveEditor1 = new CurveEditor(editorNode1, {width: 400, height: 200});
    curveEditor2 = new CurveEditor(editorNode2, {width: 400, height: 200});

}

function randomWalk(magnitude) {
    return Math.random() * magnitude - magnitude/2;
}

function animate() {
	requestAnimationFrame(animate);
	// renderer.render(scene, camera);
    curveEditor1.render();
    curveEditor2.render();
}
