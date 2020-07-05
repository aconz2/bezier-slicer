import {SVGLoader} from './three.js/examples/jsm/loaders/SVGLoader.js';
import {curveTo3At} from './util.js';
import * as THREE from './three.js/build/three.module.js';

let test = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg
   xmlns:dc="http://purl.org/dc/elements/1.1/"
   xmlns:cc="http://creativecommons.org/ns#"
   xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
   xmlns:svg="http://www.w3.org/2000/svg"
   xmlns="http://www.w3.org/2000/svg"
   id="svg8"
   version="1.1"
   viewBox="0 0 210 297"
   height="297mm"
   width="210mm">
  <defs
     id="defs2" />
  <metadata
     id="metadata5">
    <rdf:RDF>
      <cc:Work
         rdf:about="">
        <dc:format>image/svg+xml</dc:format>
        <dc:type
           rdf:resource="http://purl.org/dc/dcmitype/StillImage" />
        <dc:title></dc:title>
      </cc:Work>
    </rdf:RDF>
  </metadata>
  <g
     id="layer1">
    <path
       id="path815"
       d="m 52.036542,55.224834 c 6.657254,-4.317272 13.537595,1.638508 19.13246,-1.460663 5.164423,-2.860736 9.84796,-20.666666 10.509106,-14.255748 1.711109,16.592042 14.946957,-1.107667 16.903642,3.437082 1.8596,4.319257 -7.024138,9.310537 -5.609675,13.795298 2.372147,7.521249 7.661315,11.360004 13.341945,2.425545 2.59214,-4.076917 4.55049,-9.210638 8.79355,-11.521346 3.5492,-1.932833 8.1693,-1.943119 12.08702,-0.950877 3.80996,0.964945 9.26227,2.530066 9.89688,6.408357 1.07695,6.581436 -7.54925,9.656095 -12.64246,9.385595 -5.50429,-0.292331 -3.70932,5.576333 -1.45756,9.260796 3.25649,5.328474 10.53638,8.03101 11.61542,3.197868 1.20647,-5.403943 8.58446,-6.758426 14.06404,-7.468784 6.22856,-0.807453 15.40855,3.297087 3.88509,10.637975 -6.55027,4.172771 -8.92408,7.232667 -9.70323,12.430935 -0.54531,3.638165 6.43184,7.600189 3.94194,10.308553 -3.52061,3.82952 -11.29454,-5.061886 -14.99414,-4.32885 -5.14848,1.020109 -10.46898,-2.04147 -12.1446,-2.492984 -4.43058,-1.193871 5.5025,11.256494 1.2129,12.885714 -7.64341,2.90302 -3.15809,14.45737 -7.42903,18.64639 -2.60413,2.55418 -8.08698,0.50634 -10.76454,-1.97076 -6.59996,-6.10587 5.7794,-13.0961 4.24517,-16.82723 -3.63539,-8.841043 -14.059618,12.32537 -19.709698,8.03463 -2.795571,-2.123 0.05997,-7.1448 1.21291,-10.46018 1.483184,-4.26501 8.658168,-7.273745 7.125808,-11.521341 -1.123098,-3.113135 -6.340604,0.05559 -9.411136,-3.166052 C 78.687926,81.837712 79.39396,79.223961 77.355917,92.366013 76.309803,99.111745 67.768169,107.06022 65.372274,100.39087 61.240556,88.889587 56.119866,98.454255 52.794607,102.3714 49.459445,106.3002 48.516828,92.212282 49.762345,87.211733 51.853679,78.81536 65.696159,77.596398 69.472045,71.294081 72.641209,66.004442 46.862632,58.580147 52.036542,55.224834 Z"
       style="fill:none;fill-rule:evenodd;stroke:#000000;stroke-width:0.26458332px;stroke-linecap:butt;stroke-linejoin:miter;stroke-opacity:1" />
  </g>
</svg>
`;

export function SVGPreview(container, opt) {
    opt = opt || {};
    this.container = container;

    const width = opt.width || 400;
    const height = opt.height || 400;
    const gridSize =  Math.max(width, height);
    const divisions = opt.divisions || 10;
    const pointsPerLength = 0.25;
    const lineColor = opt.lineColor || 0xff0000;

    const top    =  height / 2;
    const bottom = -height / 2;
    const right  =  width / 2;
    const left   = -width / 2;
    const margin = 10;
    this.camera = new THREE.OrthographicCamera(left, right, top, bottom);

    this.camera.position.set(0, 0, 10);

	this.renderer = new THREE.WebGLRenderer({antialias: true});
	this.renderer.setPixelRatio(window.devicePixelRatio);
	this.renderer.setSize(width, height);
	this.container.appendChild(this.renderer.domElement);

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

    let blob = new Blob([test]);
    let loader = new SVGLoader();
    loader.load(URL.createObjectURL(blob), (data) => {
        console.log(data)
        let paths = [];
        let geoms = [];
        for (let path of data.paths) {
            for (let subPath of path.subPaths) {
                let curve = curveTo3At(subPath, 1);
                let geom = new THREE.BufferGeometry();
                let nPoints = Math.floor(curve.getLength() * pointsPerLength);
                let points = curve.getPoints(nPoints);
                geom.setFromPoints(points);
                console.log(nPoints)
                console.log(points.length)
                // console.log(curve.getPoints(Math.floor(curve.getLength() * pointsPerLength)).length);
                let mesh = new THREE.Line(geom, this.lineMaterial);
                this.meshes.push(mesh);
                this.scene.add(mesh);
            }
        }
        console.log(this.meshes);
        this.focusOn(0);
    });

    this.focusOn = (i) => {
        if (i < 0 || i > this.meshes.length) return;
        for (let mesh of this.meshes) mesh.visible = false;
        this.meshes[i].visible = true;
        this.meshes[i].geometry.computeBoundingBox();
        let bb = this.meshes[i].geometry.boundingBox;
        this.camera.left = bb.min.x - margin;
        this.camera.right = bb.max.x + margin;
        this.camera.top = bb.max.y + margin;
        this.camera.bottom = bb.min.y - margin;
        this.camera.updateProjectionMatrix();
    };


    this.render = () => {
	    this.renderer.render(this.scene, this.camera);
    };

}
