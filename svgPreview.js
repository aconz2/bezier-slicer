import {SVGLoader} from './three.js/SVGLoader.js';
import {medianPoint, curveTo3At, centerCurve} from './util.js';
import * as THREE from './three.js/three.module.js';

export function SVGPreview(container, opt) {
    opt = opt || {};
    this.container = container;

    const width = opt.width || 400;
    const height = opt.height || 400;
    const gridSize =  Math.max(width, height);
    const divisions = opt.divisions || 10;
    const pointsPerLength = 1;
    const lineColor = opt.lineColor || 0xff0000;

    const top    =  height / 2;
    const bottom = -height / 2;
    const right  =  width / 2;
    const left   = -width / 2;
    const margin = 10;
    this.camera = new THREE.OrthographicCamera(left, right, top, bottom);

    this.camera.position.set(0, 0, 10);

    this.onChange = (() => {});

	this.renderer = new THREE.WebGLRenderer({antialias: true});
	this.renderer.setPixelRatio(window.devicePixelRatio);
	this.renderer.setSize(width, height);
	this.container.appendChild(this.renderer.domElement);

    this.select = document.createElement('select')
    this.container.appendChild(this.select);

    this.select.onchange = (event) => {
        this.focusOn(Number.parseInt(event.target.value));
    };

	this.scene = new THREE.Scene();
	this.scene.background = new THREE.Color(0x333333);

	let grid = new THREE.GridHelper(gridSize, gridSize / divisions);
    grid.position.y = -1;
	grid.rotateX(-Math.PI / 2);
	grid.material.opacity = 0.25;
	grid.material.transparent = true;
    this.scene.add(grid);

    this.lineMaterial = new THREE.MeshBasicMaterial({color: lineColor});

    this.meshes = [];
    this.curves = [];
    this.active = -1;

    this.load = (url) => {
        for (let mesh of this.meshes) {
            this.scene.remove(mesh);
        }
        this.meshes = [];
        this.curves = [];
        for (let child of this.select.querySelectorAll('option')) {
            child.remove();
        }

        let loader = new SVGLoader();
        loader.load(url, (data) => {
            console.log(data)
            let paths = [];
            let geoms = [];
            for (let path of data.paths) {
                for (let subPath of path.subPaths) {
                    let curve = centerCurve(curveTo3At(subPath, 0));
                    console.log(medianPoint(curve));
                    this.curves.push(curve);
                    let geom = new THREE.BufferGeometry();
                    let nPoints = Math.floor(curve.getLength() * pointsPerLength / subPath.curves.length);
                    let points = curve.getPoints(nPoints);
                    geom.setFromPoints(points);
                    let mesh = new THREE.Line(geom, this.lineMaterial);
                    this.meshes.push(mesh);
                    this.scene.add(mesh);
                    let option = document.createElement('option');
                    option.value = this.meshes.length - 1;
                    option.innerText = `Path ${option.value}`
                    this.select.appendChild(option);
                }
            }
            this.focusOn(0);
        });
    };

    this.focusOn = (i) => {
        if (i < 0 || i >= this.meshes.length) return;
        this.active = i;
        for (let mesh of this.meshes) mesh.visible = false;
        this.meshes[i].visible = true;
        this.meshes[i].geometry.computeBoundingBox();
        let bb = this.meshes[i].geometry.boundingBox;
        this.camera.left = bb.min.x - margin;
        this.camera.right = bb.max.x + margin;
        this.camera.top = bb.max.y + margin;
        this.camera.bottom = bb.min.y - margin;
        this.camera.updateProjectionMatrix();
        this.onChange(this.meshes[i]);
    };

    this.getCurve = () => {
        if (this.curves.length === 0) {
            return new THREE.CatmullRomCurve3([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(100, 0, 0),
            ]);
        } else {
            return this.curves[this.active];
        }
    }

    this.render = () => {
	    this.renderer.render(this.scene, this.camera);
    };

}
