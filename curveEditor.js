import * as THREE from './three.js/build/three.module.js';

var camera, scene, renderer;

init();
animate();

function init() {
    var width = 400;
    var height = 200;

    THREE.Object3D.DefaultUp = new THREE.Vector3(0,0,1);

	renderer = new THREE.WebGLRenderer();
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(width, height);
	document.querySelector('#editor').appendChild(renderer.domElement);

	scene = new THREE.Scene();
	scene.background = new THREE.Color(0x333333);

	scene.add(new THREE.AmbientLight(0x222222, 5));

    var top = height / 2;
    var bottom = -height / 2;
    var left = -width / 2;
    var right = width / 2;
    camera = new THREE.OrthographicCamera(left, right, top, bottom);
	// camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
    camera.position.set(10, 10, 100);

    var divisions = 10;

    var gridSize =  Math.max(width, height);
	var grid = new THREE.GridHelper(gridSize, gridSize / divisions);

	grid.rotateX(- Math.PI / 2 );
	grid.material.opacity = 0.25;
	grid.material.transparent = true;
    scene.add(grid);

    var curve = new THREE.CatmullRomCurve3( [
	    new THREE.Vector3(left, bottom, 0),
	    new THREE.Vector3(left/3, bottom/2, 0),
	    // new THREE.Vector3( -5, 5, 0),
	    // new THREE.Vector3( 0, 0, 0),
	    new THREE.Vector3(right, top, 0),
    ]);
    var points = curve.getPoints( 50 );
    var geometry = new THREE.BufferGeometry().setFromPoints( points );

    var material = new THREE.LineBasicMaterial( { color : 0xff0000 } );

    // Create the final object to add to the scene
    var curveObject = new THREE.Line( geometry, material );
    scene.add(curveObject);
}

function animate() {
	requestAnimationFrame(animate);
	renderer.render(scene, camera);
}
