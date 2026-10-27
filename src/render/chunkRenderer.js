// Материалы чанков (ShaderMaterial) и сборка геометрии из результата воркера
import * as THREE from 'three';
import { buildAtlas, atlasMipmaps, ATLAS } from './textures.js';

export function createAtlasTexture() {
  const data = buildAtlas();
  const levels = atlasMipmaps();
  const tex = new THREE.DataTexture(data, ATLAS, ATLAS, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.mipmaps = levels.map((l) => ({ data: l.data, width: l.width, height: l.height }));
  tex.generateMipmaps = false;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

const VERT = /* glsl */`
attribute vec4 aUV;
attribute vec4 aLit;
attribute vec4 aTint;
uniform float uTime;
uniform float uWave;
varying vec2 vUv;
varying vec2 vTile;
varying float vSun;
varying float vBlk;
varying float vAO;
varying float vFace;
varying float vType;
varying vec3 vTint;
varying float vDist;
void main() {
  vec3 p = position * (1.0 / 16.0);
  float w = aLit.w;
  float type = floor(w / 8.0 + 0.001);
  float face = w - type * 8.0;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  float tx = aUV.z;
  if (type > 0.5 && type < 1.5) { // вода
    tx += floor(mod(uTime * 7.0, 8.0));
    if (face > 1.5 && face < 2.5 || aUV.y < 15.5) {
      float off = sin(wp.x * 1.3 + uTime * 1.7) * 0.5 + sin(wp.z * 1.1 - uTime * 1.3) * 0.5 + sin((wp.x + wp.z) * 0.7 + uTime * 0.9) * 0.4;
      p.y += off * 0.045 * uWave - 0.02;
    }
  } else if (type > 1.5 && type < 2.5) { // лава
    tx += floor(mod(uTime * 2.5, 8.0));
    if (face > 1.5 && face < 2.5 || aUV.y < 15.5) p.y += sin(wp.x * 0.9 + uTime * 0.8) * sin(wp.z * 0.8 - uTime * 0.6) * 0.03 * uWave - 0.02;
  } else if (type > 2.5 && type < 3.5) { // трава/цветы
    float top = 1.0 - aUV.y / 16.0;
    float s = sin(uTime * 1.6 + wp.x * 0.9 + wp.z * 0.6) * 0.055 * top * uWave;
    p.x += s; p.z += s * 0.6;
  } else if (type > 3.5 && type < 4.5) { // листва
    p.x += sin(uTime * 1.2 + wp.x * 1.7 + wp.y * 0.9) * 0.018 * uWave;
    p.y += sin(uTime * 1.5 + wp.z * 1.4) * 0.012 * uWave;
    p.z += sin(uTime * 1.1 + wp.z * 1.6 + wp.y) * 0.018 * uWave;
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vUv = aUV.xy / 16.0;
  vTile = vec2(tx, aUV.w);
  vSun = aLit.x / 255.0;
  vBlk = aLit.y / 255.0;
  vAO = aLit.z / 255.0;
  vFace = face;
  vType = type;
  vTint = aTint.rgb;
  vDist = length(mv.xyz);
}`;

const FRAG = /* glsl */`
precision highp float;
uniform sampler2D uAtlas;
uniform float uSun;
uniform vec3 uSunCol;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uUnder;
uniform float uAmbient;
uniform float uFlash;
uniform float uGamma;
varying vec2 vUv;
varying vec2 vTile;
varying float vSun;
varying float vBlk;
varying float vAO;
varying float vFace;
varying float vType;
varying vec3 vTint;
varying float vDist;
void main() {
  vec2 uv = (vTile + clamp(vUv, 0.002, 0.998)) / 16.0;
  vec4 tex = texture2D(uAtlas, uv);
  #ifdef CUTOUT
  if (tex.a < 0.5) discard;
  #endif
  vec3 tint = vTint;
  if (vType > 4.5) {
    float sat = max(tex.r, max(tex.g, tex.b)) - min(tex.r, min(tex.g, tex.b));
    tint = mix(vTint, vec3(1.0), smoothstep(0.02, 0.07, sat));
  }
  float fs = vFace < 1.5 ? 0.82 : (vFace < 2.5 ? 1.0 : (vFace < 3.5 ? 0.52 : 0.68));
  float aoS = mix(0.5, 1.0, vAO);
  float s = pow(clamp(vSun * uSun, 0.0, 1.0), 1.5);
  float b = pow(vBlk, 1.5);
  vec3 L = max(uSunCol * s, vec3(1.0, 0.8, 0.58) * b * 1.15);
  L = max(L, vec3(uAmbient));
  L += vec3(uFlash);
  vec3 col = tex.rgb * tint * L * fs * aoS;
  if (vType > 1.5 && vType < 2.5) col = tex.rgb * (1.0 + 0.2 * aoS);
  col = pow(col, vec3(uGamma));
  float fog = smoothstep(uFogNear, uFogFar, vDist);
  col = mix(col, uFogColor, fog);
  if (uUnder > 0.5) col *= vec3(0.62, 0.8, 1.0);
  float a = tex.a;
  #ifdef TRANS
  if (vType > 0.5 && vType < 1.5) a = clamp(a * 1.0, 0.0, 1.0);
  a *= (1.0 - fog * 0.85);
  #endif
  gl_FragColor = vec4(col, a);
}`;

export function createChunkMaterials(atlas) {
  const uniforms = {
    uAtlas: { value: atlas }, uTime: { value: 0 }, uWave: { value: 1 }, uSun: { value: 1 }, uSunCol: { value: new THREE.Color(1, 1, 1) },
    uFogColor: { value: new THREE.Color(0.7, 0.8, 1) }, uFogNear: { value: 60 }, uFogFar: { value: 120 }, uUnder: { value: 0 },
    uAmbient: { value: 0.035 }, uFlash: { value: 0 }, uGamma: { value: 0.92 },
  };
  const mk = (defines, side, transparent, depthWrite) => new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, defines, side, transparent, depthWrite });
  return {
    uniforms,
    opaque: mk({}, THREE.FrontSide, false, true),
    cutout: mk({ CUTOUT: 1 }, THREE.FrontSide, false, true),
    trans: mk({ TRANS: 1 }, THREE.DoubleSide, true, true),
  };
}

// Строит BufferGeometry из слоя результата мешера
export function layerGeometry(l, maxY) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(l.pos, 4));
  g.setAttribute('aUV', new THREE.BufferAttribute(l.uv, 4));
  g.setAttribute('aLit', new THREE.BufferAttribute(l.lit, 4));
  g.setAttribute('aTint', new THREE.BufferAttribute(l.tint, 4, true));
  g.setIndex(new THREE.BufferAttribute(l.idx, 1));
  const hy = Math.max(8, maxY / 2 + 2);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(8, hy, 8), Math.sqrt(128 + hy * hy));
  g.boundingBox = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(16, maxY + 3, 16));
  return g;
}

export function createEntityAtlas() {
  const data = buildAtlas();
  const tex = new THREE.DataTexture(data, ATLAS, ATLAS, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.flipY = false; tex.needsUpdate = true;
  return tex;
}
