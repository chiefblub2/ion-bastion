/**
 * Paints the Sector Atlas's globe into a canvas with WebGL: each pixel of the disc is turned back through the camera
 * (`globe.ts`) to a point of the world's plane and samples the painted surface there (a wrapping equirectangular
 * picture, `paintWrapped`), plus a sharper tile of the zoomed sector where it has one. Light comes from the upper
 * left as everywhere in the game, the night side falls dark, the limb glows in the world's atmosphere and the poles
 * carry caps (they also hide the projection's pinch). Draws only when asked (camera, size or a picture changed).
 * Without WebGL `ok` is false and the atlas keeps its flat territories.
 */
import type { Camera } from "./globe";
import { type Box, WORLD_H, WORLD_W } from "./world-map";
const VERTEX = `attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;
const FRAGMENT = `precision highp float;
uniform sampler2D uBase;uniform sampler2D uDetail;
uniform vec4 uDetailBox;uniform float uHasDetail;
uniform vec2 uCentre;uniform float uR;uniform vec2 uRot;uniform vec3 uAtmo;
const float W=${WORLD_W.toFixed(1)};const float H=${WORLD_H.toFixed(1)};const float UNIT=${((2 * Math.PI) / WORLD_W).toFixed(8)};
void main(){
  vec2 p=(gl_FragCoord.xy-uCentre)/uR;
  float d=length(p);
  float edge=clamp((1.-d)*uR,0.,1.);
  if(edge<=0.)discard;
  float z=sqrt(max(0.,1.-d*d));
  float ca=cos(uRot.y),sa=sin(uRot.y);
  vec3 v1=vec3(p.x,p.y*ca+z*sa,-p.y*sa+z*ca);
  float rel=atan(v1.x,v1.z);
  float lat=asin(clamp(v1.y,-1.,1.));
  vec2 q=vec2(W*.5+(uRot.x+rel)/UNIT,H*.5-lat/UNIT);
  vec3 col=texture2D(uBase,vec2(q.x/W,q.y/H)).rgb;
  if(uHasDetail>.5){
    float qx=mod(q.x,W);
    vec2 uv=(vec2(qx,q.y)-uDetailBox.xy)/uDetailBox.zw;
    vec2 m=min(uv,1.-uv)*uDetailBox.zw;
    float k=smoothstep(0.,2.5,min(m.x,m.y));
    if(k>0.)col=mix(col,texture2D(uDetail,uv).rgb,k);
  }
  float cap=smoothstep(.98,1.24,abs(lat));
  col=mix(col,vec3(.8,.85,.9)*(.78+.22*col.g),cap*.9);
  vec3 L=normalize(vec3(-.55,.5,.68));
  float day=smoothstep(-.3,.65,dot(vec3(p,z),L));
  col*=mix(.13,1.06,day);
  col+=uAtmo*pow(1.-z,2.6)*(.25+.45*day);
  gl_FragColor=vec4(col*edge,edge);
}`;
export class GlobeGL {
  readonly ok: boolean;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private base: WebGLTexture | null = null;
  private detail: WebGLTexture | null = null;
  private detailBox: Box | null = null;
  private atmo: [number, number, number] = [0.4, 0.8, 1];
  /** Called once a picture is on the GPU, so the owner can draw again. */
  onChange: () => void = () => {};
  constructor(private canvas: HTMLCanvasElement) {
    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext("webgl", { premultipliedAlpha: true, antialias: false, alpha: true });
    } catch {
      gl = null;
    }
    this.ok = !!gl && this.init(gl);
  }
  private init(gl: WebGLRenderingContext) {
    const shader = (type: number, source: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = shader(gl.VERTEX_SHADER, VERTEX),
      fs = shader(gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vs || !fs) return false;
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(program, "a");
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1i(gl.getUniformLocation(program, "uBase"), 0);
    gl.uniform1i(gl.getUniformLocation(program, "uDetail"), 1);
    this.gl = gl;
    this.program = program;
    return true;
  }
  /** Has a surface picture: until then the atlas shows its flat territories. */
  get ready() {
    return !!this.base;
  }
  /** The atmosphere's colour along the limb, as a CSS hex colour. */
  setAtmosphere(hex: string) {
    const n = parseInt(hex.replace("#", ""), 16);
    this.atmo = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  /** Drops both pictures (another world). */
  clear() {
    const gl = this.gl;
    if (!gl) return;
    if (this.base) gl.deleteTexture(this.base);
    if (this.detail) gl.deleteTexture(this.detail);
    this.base = this.detail = null;
    this.detailBox = null;
  }
  /** The whole surface (wrapping in x); a later call replaces it with a sharper one. `stale` drops a late answer. */
  setBase(url: string, stale: () => boolean = () => false) {
    this.load(url, stale, (texture) => {
      if (this.base) this.gl!.deleteTexture(this.base);
      this.base = texture;
    }, true);
  }
  /** A sharper picture of `box` (plane units) over the surface, or none. */
  setDetail(url: string | null, box: Box | null, stale: () => boolean = () => false) {
    if (!url || !box) {
      if (this.detail) this.gl?.deleteTexture(this.detail);
      this.detail = null;
      this.detailBox = null;
      return;
    }
    this.load(url, stale, (texture) => {
      if (this.detail) this.gl!.deleteTexture(this.detail);
      this.detail = texture;
      this.detailBox = box;
    }, false);
  }
  private load(url: string, stale: () => boolean, use: (texture: WebGLTexture) => void, wrap: boolean) {
    const gl = this.gl;
    if (!gl) return;
    const img = new Image();
    img.onload = () => {
      if (stale()) return;
      const texture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      // Pictures are powers of two (`globeSize`), so they get mipmaps and the surface may repeat around the globe.
      const pot = (n: number) => (n & (n - 1)) === 0;
      if (pot(img.width) && pot(img.height)) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      use(texture);
      this.onChange();
    };
    img.src = url;
  }
  /** Draws the globe for `cam` into a `width` × `height` (CSS px) view at `dpr` device pixels per px. */
  draw(cam: Camera, width: number, height: number, dpr: number) {
    const gl = this.gl,
      program = this.program;
    if (!gl || !program) return;
    const w = Math.max(1, Math.round(width * dpr)),
      h = Math.max(1, Math.round(height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!this.base) return;
    const u = (name: string) => gl.getUniformLocation(program, name);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.base);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.detail ?? this.base);
    const box = this.detailBox ?? { x: 0, y: 0, w: 1, h: 1 };
    gl.uniform4f(u("uDetailBox"), box.x, box.y, box.w, box.h);
    gl.uniform1f(u("uHasDetail"), this.detail ? 1 : 0);
    // The canvas counts y up from its bottom edge.
    gl.uniform2f(u("uCentre"), (width / 2 + cam.ox) * dpr, h - (height / 2 + cam.oy) * dpr);
    gl.uniform1f(u("uR"), cam.r * dpr);
    gl.uniform2f(u("uRot"), cam.lon, cam.lat);
    gl.uniform3f(u("uAtmo"), ...this.atmo);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
