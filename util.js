import * as THREE from './three.js/build/three.module.js';

export function debounce(func, wait, immediate) {
  var timeout;
  return function() {
    var context = this, args = arguments;
    var later = function() {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
};

export function vector2to3(v2, z) {
    return new THREE.Vector3(v2.x, v2.y, z);
}

export function vector3to2(v3) {
    return new THREE.Vector2(v3.x, v3.y);
}

export function curveTo3At(curve, height) {
    let f = (v) => vector2to3(v, height);
    let c = curve;
    if (c.type === 'CubicBezierCurve') return new THREE.CubicBezierCurve3(f(c.v0), f(c.v1), f(c.v2), f(c.v3));
    if (c.type === 'Shape' || c.type === 'CurvePath' || c.type === 'Path') {
        var ret = new THREE.CurvePath();
        ret.curves = c.curves.map((x) => curveTo3At(x, height));
        return ret;
    }
    if (c.type === 'LineCurve') return new THREE.LineCurve3(f(c.v1), f(c.v2)); // why does this use v1 and v2 and not v0 and v1 ??????
    if (c.type === 'CatmullRomCurve3') return curve;
    throw new Error(`Unhandled curve type ${curve.type}`)
}

// based on https://krazydad.com/tutorials/makecolors.php
export function colorGradient(points, freq, width, center) {
    freq = freq || 1;
    width = width || 0.5;
    center = center || 0.5;
    let ret = new Float32Array(3 * points.length);
    for (var i = 0; i < points.length; i++) {
        ret[i * 3]     = Math.sin(freq * i )    * width + center;
        ret[i * 3 + 1] = Math.sin(freq * i + 2) * width + center;
        ret[i * 3 + 2] = Math.sin(freq * i + 4) * width + center;
    }
    return ret;
}

export function colorGradientToCenter(points, freq, width, center) {
    freq = freq || 1;
    width = width || 0.5;
    center = center || 0.5;
    let origin = new THREE.Vector3(0, 0, 0);
    let ret = new Float32Array(3 * points.length);
    for (var i = 0; i < points.length; i++) {
        origin.setZ(points[i].z);
        let d = origin.distanceTo(points[i]);

        ret[i * 3]     = Math.sin(freq * d ) * width + center;
        ret[i * 3 + 1] = Math.sin(freq * d + 2) * width + center;
        ret[i * 3 + 2] = Math.sin(freq * d + 4) * width + center;
    }
    return ret;
}
