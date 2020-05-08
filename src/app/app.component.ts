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
  mesh: THREE.Mesh;
  plane: THREE.Mesh;
  plane2: THREE.Mesh;
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

  clock: THREE.Clock;
  sineContext: CanvasRenderingContext2D;
  sineCanvas: HTMLCanvasElement;

  planeMaterial: THREE.MeshNormalMaterial;

  useWebCam: boolean = true;

  ngOnInit(): void {

    this.initWebcam().then(() => {
    });

    this.addSineWave();
    this.init().then(() => {
      this.animate();
    });


  }

  async initWebcam() {

    this.video = document.getElementById('video') as HTMLVideoElement;
    this.videoCanvas = document.getElementById('video_canvas') as HTMLCanvasElement;
    const stream = await navigator.mediaDevices.getUserMedia({video: true, audio: false});

    this.video.srcObject = stream;
    this.video.play();

  }

  addSineWave() {
    const canvas = document.createElement('canvas');
    canvas.id = 'sine-wave';
    canvas.width = 1024;
    canvas.height = 1024;
    canvas.style.position = 'absolute';
    // canvas.style.display = 'none';
    document.body.appendChild(canvas);

    this.sineCanvas = canvas;
    this.sineContext = canvas.getContext('2d');

  }

  async init() {


    this.clock = new THREE.Clock();
    this.clock.start();
    this.camera = new THREE.PerspectiveCamera(120, window.innerWidth / window.innerHeight, 0.01, 1000);
    this.camera.position.z = 1;

    this.scene = new THREE.Scene();

    this.geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    this.material = new THREE.MeshNormalMaterial({
      wireframe: true,
      opacity: 0.2
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(this.mesh);

    const videoTexture = new THREE.Texture(this.sineCanvas);

    videoTexture.offset.set(0.1, 0.2);
    videoTexture.flipY = true;
    videoTexture.center.set(1, 0);

    this.videoTexture = videoTexture;


    const planeGeometry = new THREE.PlaneGeometry(80, 8, 80, 10);
    const planeGeometry2 = new THREE.PlaneGeometry(50, 10, 4, 20);
    this.planeMaterial = new THREE.MeshNormalMaterial({
      wireframe: true,
      wireframeLinewidth: 1,
      opacity: 0.2,
      transparent: true
    });

    const movieMaterial = new THREE.SpriteMaterial({map: this.videoTexture, transparent: true});
    const planeVideo = new THREE.Sprite(movieMaterial);
    planeVideo.scale.set(4, 10, 10);
    planeVideo.position.set(0, -2, 3);

    this.scene.background = this.videoTexture;
    // this.scene.add(planeVideo);


    var vertices = [];

    for (var i = 0; i < 10000; i++) {

      var x = THREE.MathUtils.randFloatSpread(10);
      var y = THREE.MathUtils.randFloatSpread(10);
      var z = THREE.MathUtils.randFloatSpread(100);

      vertices.push(x, y, z);

    }

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));


    const loader = new THREE.ImageLoader();

    loader.load('/assets/particle-3.jpg', (image) => {
      this.pointsMaterial = new THREE.PointsMaterial({ color: 0xFFFFFF, size: 1, transparent: true});
      this.points = new THREE.Points(geometry, this.pointsMaterial);

      const particleTexture = new THREE.Texture(image);
      particleTexture.needsUpdate = true;
      this.pointsMaterial.map = particleTexture;
      this.pointsMaterial.alphaMap = particleTexture;
      this.pointsMaterial.blending = 1;
      this.pointsMaterial.alphaTest = 0.5;
      this.pointsMaterial.needsUpdate = true;

      this.scene.add(this.points);
    });

    this.plane = new THREE.Mesh(planeGeometry, this.planeMaterial);
    this.plane2 = new THREE.Mesh(planeGeometry2, this.planeMaterial);

    this.plane.position.set(0, 0, 0);
    this.plane2.position.set(-45, 0, 0);
    this.scene.add(this.plane);
    this.scene.add(this.plane2);

    this.renderer = new THREE.WebGLRenderer({antialias: true});
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);


    const color = 0xFFFFFF;

    this.scene.fog = new THREE.Fog(color, 0.1, 1000);

    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderPass);

    this.mirrorShader = MirrorShader;
    this.mirrorPass = new ShaderPass(this.mirrorShader);
    this.composer.addPass(this.mirrorPass);

    const glitchPass = new GlitchPass(100);
    glitchPass.randX = 0.01;

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 1, 1, 0.1);
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

    analyser.fftSize = 1024;
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

    let lowerMax = max(lowerHalfArray) - 5;
    let lowerAvg = avg(lowerHalfArray) * 0.9;
    let upperAvg = avg(upperHalfArray) * 0.5;
    let upperMax = max(upperHalfArray);
    let lowerMaxFr = lowerMax / lowerHalfArray.length;
    let upperAvgFr = lowerAvg / lowerHalfArray.length;
    let lowerAvgFr = upperAvg / upperHalfArray.length;


    this.planeMaterial.opacity = upperAvgFr * 2;
    this.planeMaterial.needsUpdate = true;
    this.sineContext.beginPath();
    this.sineContext.moveTo(0, this.sineCanvas.height / 2);

    const amplitude = upperAvgFr;
    this.sineContext.clearRect(0, 0, this.sineCanvas.width, this.sineCanvas.height);

    this.dataArrayStream.forEach((v, index) => {
      this.sineContext.lineTo(index + v * 100,  v * v);
      this.sineContext.lineWidth = 1;
      this.sineContext.strokeStyle = `rgba(255, 255, 255, 0.001)`;
    });




    this.sineContext.stroke();


    // @ts-ignore

    this.mirrorPass.uniforms.side = Math.sin(this.clock.getElapsedTime());
    const rotation = (Math.sin(this.clock.getDelta()) * 100) * 100;

    // tthis.videoTexture.repeat.set(0.1,0.1);
//     this.videoTexture.repeat.set(1 + modulate(upperAvgFr, 0, 1, 0, 1), 1 + modulate(upperAvgFr, 0, 1, 0, 1));
   //  this.videoTexture.center.set(1 + modulate(upperAvgFr, 0, 1, 0, 1), 1);

    this.bloomPass.radius = Math.sin(upperAvgFr) / 20 * Math.tan(Date.now());
    this.bloomPass.strength = Math.sin(upperAvgFr) * 5;



    this.points.rotation.x += Math.sin(upperAvg) / 100;
    this.plane.rotation.x += Math.tan(upperAvgFr * this.clock.getElapsedTime()) / 80;
     //this.mesh.rotation.y += 0.1 ;
    //this.plane2.rotation.x += 0.01;
     this.plane.rotation.y += 0.02 + upperAvgFr / 40 * Math.tan(this.clock.getElapsedTime());
     this.plane.rotation.z += 0.01 * Math.cos(lowerAvgFr) + Math.sin(Date.now()) / 1000;
     this.mesh.position.add(new THREE.Vector3(upperAvgFr, Math.sin(this.clock.getElapsedTime() / 2) / 10 , Math.cos(this.clock.getElapsedTime() * 2) / 10));
     const scaleSize = 10 + Math.tan(this.clock.getElapsedTime()) + upperAvg;
     this.mesh.scale.set(scaleSize, scaleSize, scaleSize);
     // this.plane.scale.set(new THREE.Vector3(scaleSize / 100, scaleSize / 100, scaleSize / 100));

  //   this.points.rotation.x += 0.01;
    this.points.position.add(new THREE.Vector3(0, Math.tan(0.00001 * upperAvgFr), 0));
     this.pointsMaterial.size = Math.sin(this.clock.getElapsedTime()) / 100 + 0.05;


     this.camera.rotation.x = -180;
    // this.camera.rotation.y = upperAvgFr + 100;
    // this.camera.rotation.z -= 0.01;
       this.camera.position.y = Math.sin(this.clock.getElapsedTime()) * 1 - 5;
       this.camera.position.z = -3;
      this.camera.fov = 190 + upperAvgFr * 0.5;

    // console.log(lowerAvgFr, upperAvgFr, lowerMaxFr);

    if (this.useWebCam) {
      const canvas_context = this.videoCanvas.getContext('2d');
      canvas_context.drawImage(this.video, 0, 0, 640, 480);
      // canvas_context.fillStyle = `rgba(0, ${Math.random() * 10}, 0, ${Math.random() + 0.0})`;
      canvas_context.fillRect(0, 0, 700, 500);
      this.videoTexture.needsUpdate = true;
    }

    const factor = modulate(lowerAvgFr * 2, Math.cos(0.02 * this.clock.getElapsedTime()) / upperAvgFr / 1000, Math.cos(this.clock.getElapsedTime()) + 2, 0, Math.sin(this.clock.getElapsedTime()) * upperAvgFr + 100 )
    this.makeRoughGround(this.plane, factor);
    this.makeRoughGround(this.plane2, factor * 20);

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
