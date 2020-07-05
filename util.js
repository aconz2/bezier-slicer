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

function vector2to3(v2, z) {
    return new THREE.Vector3(v2.x, v2.y, z);
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
    throw new Error(`Unhandled curve type ${curve.type}`)
}
