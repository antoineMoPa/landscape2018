/*
   Copyright 2018 Antoine Morin-Paulhus
   Started from Three.js Collada example code (the one with the elf)
   
   This file is part of neon.
   

   neon is free software: you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation, either version 3 of the License, or
   (at your option) any later version.
   
   neon is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.
   
   You should have received a copy of the GNU General Public License
   along with neon.  If not, see <https://www.gnu.org/licenses/>.
 */

// This is best enjoyed with: https://www.youtube.com/watch?v=p_wcC1l1cLk
// (Voyage - Paradise) Uploaded by Electronic Gems

function start(){
	init();
	animate();
}

if (! Detector.webgl) Detector.addGetWebGLMessage();

var shaders_to_load = [
	"sky_fragment.glsl", "sky_vertex.glsl",
	"post_fragment.glsl", "post_vertex.glsl",
	"buildings_fragment.glsl", "buildings_vertex.glsl",
	"skyroads_fragment.glsl", "skyroads_vertex.glsl",
	"ground_fragment.glsl", "ground_vertex.glsl",
	"misc_fragment.glsl", "misc_vertex.glsl"
];

var loaded_shaders = 0;
var shaders = {};

for(var i = 0; i < shaders_to_load.length; i++){	
	var curr = i;

	function load(){
		shaders[this.shader_name] = this.responseText;
		loaded_shaders++;
		if(loaded_shaders == shaders_to_load.length){
			start();
		}
	}
	
	var req = new XMLHttpRequest();
	req.shader_name = shaders_to_load[i];
	req.addEventListener('load', load);
	//req.overrideMimeType("text/x-shader");
	req.open('GET', "./shaders/" + shaders_to_load[i]);
	req.send();
}

var container, stats, clock, uniforms;
var camera, scene, renderer, composer, ppshader;
var scene_model, sky, skyroads;
var renderPass, depthPass, shaderPass;
var misc_material;
var collada;
//var player_width = 800;
//var player_height = 500;
var player_width = window.innerWidth;
var player_height = window.innerHeight;
var elevators = [];

function init(){
	container = document.getElementById('container');

	scene = new THREE.Scene();
	clock = new THREE.Clock();
	
	camera = new THREE.PerspectiveCamera(45, player_width / player_height, 0.1, 2000);
	camera.position.set(1.8, 0.5, 2.0);
	camera.lookAt(0, 0.5, 0);
	
	var textureLoader = new THREE.TextureLoader();

	uniforms = {};
	
	uniforms = THREE.UniformsUtils.merge(
		[
			THREE.UniformsLib['common'],
			THREE.UniformsLib['lights']
		]
	);

	uniforms.time = {
		value: 0.0
	};
			
	var skyMaterial = new THREE.ShaderMaterial(
		{
			uniforms: uniforms,
			vertexShader: shaders['sky_vertex.glsl'],
			fragmentShader: shaders['sky_fragment.glsl'],
			side: THREE.BackSide
		}
	);

	var skyBox = new THREE.BoxBufferGeometry(100, 100, 100);
	sky = new THREE.Mesh(skyBox, skyMaterial);
	scene.add(sky);
	
	// loading manager
	var loadingManager = new THREE.LoadingManager(function(){
		scene.add(scene_model);
	});
	
	// collada
	var loader = new THREE.ColladaLoader(loadingManager);

	loader.load('./models/scene/scene.dae', function (_collada){
		collada = _collada;
		scene_model = _collada.scene;
		
		var buildings = scene_model.getObjectByName("buildings");
		
		buildings.material = new THREE.ShaderMaterial(
			{
				transparent: false,
				uniforms: uniforms,
				vertexShader: shaders['buildings_vertex.glsl'],
				fragmentShader: shaders['buildings_fragment.glsl'],
			}
		);

		skyroads = scene_model.getObjectByName("skyroads");

		var texture = THREE.ImageUtils.loadTexture("./models/scene/tex.png");
		
		skyroads.material = new THREE.ShaderMaterial(
			{
				transparent: true,
				uniforms: {
					time: {
						type: "f",
						value: 0.0
					},
					tex: {
						type: "t",
						value: texture
					}
				},
				vertexShader: shaders['skyroads_vertex.glsl'],
				fragmentShader: shaders['skyroads_fragment.glsl'],
				side: THREE.DoubleSide
			}
		);

		var ground = scene_model.getObjectByName("ground");
		
		ground.material = new THREE.ShaderMaterial(
			{
				uniforms: uniforms,
				vertexShader: shaders['ground_vertex.glsl'],
				fragmentShader: shaders['ground_fragment.glsl'],
			}
		);

		misc_material = new THREE.ShaderMaterial(
			{
				uniforms: uniforms,
				vertexShader: shaders['misc_vertex.glsl'],
				fragmentShader: shaders['misc_fragment.glsl'],
			}
		);

		elevators[0] = scene_model.getObjectByName("elevator_1");
		
		elevators[0].material = misc_material;
		elevators[0].max_height = elevators[0].position.z;
		
	});
	
	var ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
	scene.add(ambientLight);

	// Post-Process uniforms
	var ppuniforms = {};

	ppuniforms['time'] = { type: "f", value: 0.0 };
	ppuniforms['cameraNear'] = { type: "f", value: camera.near };
	ppuniforms['cameraFar'] = { type: "f", value: camera.far };
	ppuniforms['tDiffuse'] = { type: "t", value: null };
	ppuniforms['tDepth'] = { type: "t", value: null };
	
	ppshader = {
		uniforms: ppuniforms,
		defines: {
			'DEPTH_PACKING': 1
		},
		vertexShader: shaders['post_vertex.glsl'],
		fragmentShader: shaders['post_fragment.glsl']
	};
	
	renderer = new THREE.WebGLRenderer({alpha: true});
	renderer.shadowMap.enabled = true;
	
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(player_width, player_height);
	container.appendChild(renderer.domElement);
	//
	stats = new Stats();
	container.appendChild(stats.dom);
	//
	window.addEventListener('resize', onWindowResize, false);

	composer = new THREE.EffectComposer(renderer);
	renderPass = new THREE.RenderPass(scene, camera);
	depthPass = new THREE.DepthPass(scene, camera);
	shaderPass = new THREE.ShaderPass(ppshader);

	shaderPass.uniforms['tDepth'].value = depthPass.renderTarget.texture;

	composer.addPass(renderPass);
	composer.addPass(depthPass);
	composer.addPass(shaderPass);

	shaderPass.renderToScreen = true;
}

function onWindowResize(){
	camera.aspect = player_width / player_height;
	camera.updateProjectionMatrix();
	renderer.setSize(player_width, player_height);
}

function animate(){
	requestAnimationFrame(animate);
	render();
	stats.update();
}

function render(){
	var delta = clock.getDelta();

	var t = shaderPass.uniforms.time.value = clock.elapsedTime;
	uniforms.time.value = clock.elapsedTime;

	if(skyroads){
		skyroads.material.uniforms.time.value = clock.elapsedTime;
	}

	if(misc_material){
		misc_material.uniforms.time.value = clock.elapsedTime;
	}

	if(elevators.length > 0){
		// Make height a sine, but
		// clamp height to make it look like it
		// is staying a bit at top and bottom of building
		var h = 1.1 * (0.5 * Math.cos(clock.elapsedTime * 0.2) + 0.5);
		h = Math.min(h, 1.0);
		h = Math.max(h, 0.0);
		// Actually, take the cos again for smoother rides
		h = 0.5 * Math.cos(h * Math.PI * 2.0) + 0.5;
		
		elevators[0].position.z = elevators[0].max_height * h;
	}

	//t = 0.2;
	
	if (t * 0.3 < 8.0) {
		// Initial translation
		camera.position.x = 0.24;
		camera.position.y = 0.3 + t * 0.01;
		camera.position.z = 10.0 - t * 0.3;
		camera.lookAt(0, 1.8, -100.0);
	} else {
		// Rotation mode
		var d = 3.0 + 2.0 * Math.cos(t * 0.3); 
		d = 3.7;
		camera.position.x = d * Math.cos(t * 0.3);
		camera.position.y = 0.3 * Math.sin(t * 0.3) + 1.8;	
		camera.position.z = d * Math.sin(t * 0.3);
		camera.lookAt(0, 1.8, 0);
	}
	
	
	
	composer.render();
}