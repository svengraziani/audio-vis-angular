import {Component, OnInit} from '@angular/core';
import * as THREE from 'three';
import {SimplexNoise} from "three/examples/jsm/math/SimplexNoise";
import {EffectComposer} from "three/examples/jsm/postprocessing/EffectComposer";
import {RenderPass} from "three/examples/jsm/postprocessing/RenderPass";
import {GlitchPass} from "three/examples/jsm/postprocessing/GlitchPass";
import {ShaderPass} from "three/examples/jsm/postprocessing/ShaderPass";
import {MirrorShader} from "three/examples/jsm/shaders/MirrorShader";
import {UnrealBloomPass} from "three/examples/jsm/postprocessing/UnrealBloomPass";
let noise = new SimplexNoise();

//some helper functions here
function fractionate(val, minVal, maxVal) {
  return (val - minVal) / (maxVal - minVal);
}

function modulate(val, minVal, maxVal, outMin, outMax) {
  let fr = fractionate(val, minVal, maxVal);
  let delta = outMax - outMin;
  return outMin + (fr * delta);
}

function avg(arr) {
  let total = arr.reduce(function (sum, b) {
    return sum + b;
  });
  return (total / arr.length);
}

function max(arr) {
  return arr.reduce(function (a, b) {
    return Math.max(a, b);
  })
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {

  camera: THREE.PerspectiveCamera;
  scene;
  renderer;
  geometry;
  material;
  mesh;
  plane: THREE.Mesh;
  composer;

  analyzer: AnalyserNode;
  dataArrayStream: Uint8Array;
  bloomPass: UnrealBloomPass;
  mirrorShader: any;
  mirrorPass: ShaderPass;
  points: THREE.Points;
  pointsMaterial: THREE.PointsMaterial;
  videoCanvas: HTMLCanvasElement;
  video: HTMLVideoElement;
  videoTexture: THREE.Texture;

  ngOnInit(): void {
    this.initWebcam().then(() => {
      this.init().then(() => {
         this.animate();
      });
    });

  }

  async initWebcam() {

    this.video = document.getElementById('video') as HTMLVideoElement;
    this.videoCanvas = document.getElementById('video_canvas') as HTMLCanvasElement;
    const stream = await navigator.mediaDevices.getUserMedia({video: true, audio: false});

    this.video.srcObject = stream;
    this.video.play();

  }

  async init() {

    this.camera = new THREE.PerspectiveCamera(120, window.innerWidth / window.innerHeight, 0.01, 100);
    this.camera.position.z = 1;

    this.scene = new THREE.Scene();

    this.geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    this.material = new THREE.MeshNormalMaterial();

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(this.mesh);

    const videoTexture = new THREE.Texture( this.videoCanvas );
    // videoTexture.minFilter = THREE.LinearFilter;
    // videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.offset.set(0.1, 0.2);
    videoTexture.flipY = true;
    videoTexture.center.set(1,0);

    this.videoTexture = videoTexture;



    const planeGeometry = new THREE.PlaneGeometry(10, 10, 50, 50);
    const planeMaterial = new THREE.MeshNormalMaterial({
      wireframe: true
    });

    const movieMaterial = new THREE.SpriteMaterial( { map: this.videoTexture, transparent: true } );
    const planeVideo = new THREE.Sprite(movieMaterial);
    planeVideo.scale.set(10,10, 10);
    planeVideo.position.set(0, -2,3);

    this.scene.background = this.videoTexture;
    // this.scene.add(planeVideo);


    var vertices = [];

    for (var i = 0; i < 10000; i++) {

      var x = THREE.MathUtils.randFloatSpread(10);
      var y = THREE.MathUtils.randFloatSpread(10);
      var z = THREE.MathUtils.randFloatSpread(10);

      vertices.push(x, y, z);

    }

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    this.pointsMaterial = new THREE.PointsMaterial({color: 0xFFFFFFF, size: 0.001, opacity: 0.2});
    this.points = new THREE.Points(geometry, this.pointsMaterial);

    this.scene.add(this.points);


    this.plane = new THREE.Mesh(planeGeometry, planeMaterial);

    this.plane.position.set(0, 0, 0);
    this.scene.add(this.plane);

    this.renderer = new THREE.WebGLRenderer({antialias: true});
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);


    const color = 0xFFFFFF;
    const density = 0.5;
    this.scene.fog = new THREE.FogExp2(color, density);

    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderPass);

    this.mirrorShader = MirrorShader;
    this.mirrorPass = new ShaderPass(this.mirrorShader);
    ///this.composer.addPass(this.mirrorPass);

    const glitchPass = new GlitchPass(100);
    glitchPass.randX = 0.1;


    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 1, 1, 0.4);
    this.composer.addPass(this.bloomPass);

    this.composer.addPass(glitchPass);


    return await this.bindAudioStream();
  }

  async bindAudioStream() {
    const mediaAudioStreamSource = await navigator.mediaDevices.getUserMedia({audio: true});
    const context = new AudioContext();
    const src = context.createMediaStreamSource(mediaAudioStreamSource);
    const analyser = context.createAnalyser();

    src.connect(analyser);
    // analyser.connect(context.destination);

    analyser.fftSize = 512;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    this.analyzer = analyser;
    this.dataArrayStream = dataArray;

  }


  animate(): void {

    requestAnimationFrame(this.animate.bind(this));


    this.render();

    this.composer.render();
  }

  render(dt: any = 0): void {
    this.analyzer.getByteFrequencyData(this.dataArrayStream);
    let lowerHalfArray = this.dataArrayStream.slice(0, (this.dataArrayStream.length / 2) - 1);
    let upperHalfArray = this.dataArrayStream.slice((this.dataArrayStream.length / 2) - 1, this.dataArrayStream.length - 1);

    let lowerMax = max(lowerHalfArray);
    let lowerAvg = avg(lowerHalfArray);
    let upperAvg = avg(upperHalfArray);
    let upperMax = max(upperHalfArray);
    let lowerMaxFr = lowerMax / lowerHalfArray.length;
    let lowerAvgFr = lowerAvg / lowerHalfArray.length;
    let upperAvgFr = upperAvg / upperHalfArray.length;

    // @ts-ignore

    // this.mirrorPass.uniforms.side = 1;


    this.videoTexture.repeat.set(1 + modulate(upperAvgFr, 0, 1, 0, 1), 1 + modulate(upperAvgFr, 0, 1, 0, 1));
    this.videoTexture.center.set(1 + modulate(upperAvgFr, 0, 1, 0, 1), 1);

    this.bloomPass.radius = Math.sin(upperAvgFr) / 2 * Math.tan(Date.now());
    this.bloomPass.strength = Math.sin(upperMax) * 10;
    this.mesh.rotation.x += Math.tan(upperAvgFr) / 10;
    this.mesh.rotation.y += Math.sin(upperAvgFr) / 10;
    this.plane.rotation.z += 0.01 * Math.cos(lowerAvgFr) + Math.sin(Date.now()) / 1000;

    this.points.rotation.x += 0.01;
    this.points.position.add(new THREE.Vector3(0, Math.tan(0.00001 * upperAvgFr), 0));
    this.pointsMaterial.size = Math.sin(upperAvgFr) * 0.01;

    this.camera.rotation.x = Math.tan(0.001 * lowerMax);
    this.camera.rotation.y -= 0.01;
    this.camera.rotation.z += 0.01;
    this.camera.fov = 120 * Math.sin(upperAvgFr);

    // console.log(lowerAvgFr, upperAvgFr, lowerMaxFr);

    const canvas_context = this.videoCanvas.getContext('2d');
    canvas_context.drawImage(this.video, 0, 0, 640, 480);
    canvas_context.fillStyle = `rgba(0, ${Math.random()*10}, 0, ${Math.random()+0.7})`;
    canvas_context.fillRect(0, 0, 700, 500);
    this.videoTexture.needsUpdate = true;

    this.makeRoughGround(this.plane, modulate(lowerAvgFr, 0, 1, 0.5, 10));

  }

  makeRoughGround(mesh, distortionFr) {
    mesh.geometry.vertices.forEach(function (vertex, i) {
      let amp = 0.05;
      let time = Date.now();
      const xin = vertex.x + time * 0.0003;
      const yin = vertex.y + time * 0.00001;
      const noiseC = noise.noise(xin, yin);
      const distance = (noiseC + 0) * distortionFr * amp;
      vertex.z = distance;
    });
    mesh.geometry.verticesNeedUpdate = true;
    mesh.geometry.normalsNeedUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.geometry.computeFaceNormals();
  }

}
