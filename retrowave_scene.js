"use strict";

/////////////////////////////////////////////////////////////////////////////////
// THINGS TO IMPROVE
/////////////////////////////////////////////////////////////////////////////////
// OPTIMIZE OVERALL PERFORMANCE!
// Adjust visuals according to performance
// Tinker some more with the palmtrees/pyramids placement algorithm (far from being perfect actually)
// Adapt pyramid placement algorithm to palmtrees
// Pyramids + Palm trees : I want to be able to control their linewidth properly (the linewidth setting has no effect, it needs a workaroud)
// Pyramids are "duplicated" to display their wireframe (blue) over their solid color (black), would be better to achieve this effect with a tweaked shader instead
// Palmtrees : Import a proper 3D model and make it work with the current shaders
// Adjust ReinhardToneMapping settings for better bloom
// Add radomly flying birds
// Find a way to generate procedural sky only on the visible area (and ignore the rest) to ease ressource usage

import * as THREE from "./node_modules/three/build/three.module.js";

import Stats from "./node_modules/three/examples/jsm/libs/stats.module.js"; // To get FPS counter

import { BufferGeometryUtils } from "./node_modules/three/examples/jsm/utils/BufferGeometryUtils.js"; // To be able to buffer geometries
import { SVGLoader } from "./node_modules/three/examples/jsm/loaders/SVGLoader.js"; // To be able to load SVG graphics
import { SceneUtils } from "./node_modules/three/examples/jsm/utils/SceneUtils.js";

// POST-PROCESSING
import { EffectComposer } from "./node_modules/three/examples/jsm/postprocessing/EffectComposer.js"; // To merge post-processing effects
import { RenderPass } from "./node_modules/three/examples/jsm/postprocessing/RenderPass.js"; // To render post-processing effects
import { UnrealBloomPass } from "./node_modules/three/examples/jsm/postprocessing/UnrealBloomPass.js"; // Bloom/Glow
import { GlitchPass } from "./node_modules/three/examples/jsm/postprocessing/GlitchPass.js"; // Glitch effect
import { FilmPass } from "./node_modules/three/examples/jsm/postprocessing/FilmPass.js"; // CRT effect

/////////////////////////////////////////////////////////////////////////////////
// RETROWAVE SCENE
/////////////////////////////////////////////////////////////////////////////////

/**
 * RetrowaveScene class
 * On call, sets all minimum requirement for the scene to work
 */
export var RetrowaveScene = function (scenePath) {
	// DEFAULT ANIMATION SPEED
	// This can be changed anytime with setAnimationSpeed method (changing directly this.animationSpeed won't have any effect as the whole animation relies on shaders uniforms)
	this.animationSpeed = 15;

	// SCENE PATH
	// As relative path doesn't work properly, the user can set the scene path to be able to load graphics
	if (!scenePath) {
		scenePath = ''; // If unspecified, scenePath is an empty string
	}
	this.scenePath = scenePath;

	// DEFAULT TEXTURE RESOLUTION
	// As for the skybox, for some odd reason, 2048 are heavier than 4096 in file weight, but use less ressource... 1024 textures are really hugly, use only if required
	this.textureResolution = 2048; // Could make this dynamically editable later on

	// RESSOURCES
	// You can set all SVG files you want to load in this array...
	this.svgFiles = [
		[`./${this.scenePath}scenery/sun.svg`, 0, 40, -500, 0.11, "sun"],
		[`./${this.scenePath}scenery/city_far.svg`, 0, 15, -450, 0.4, "cityFar"],
		[`./${this.scenePath}scenery/city_close.svg`, 0, 28, -300, 0.2, "cityClose"],
	];
	// ... and specify your skybox textures here
	this.skybox = [
		`./${this.scenePath}skybox/${this.textureResolution}/px.png`, // X+
		`./${this.scenePath}skybox/${this.textureResolution}/nx.png`, // X-
		`./${this.scenePath}skybox/${this.textureResolution}/py.png`, // Y+
		`./${this.scenePath}skybox/${this.textureResolution}/invisible.png`, // Y- (out of camera FoV here)
		`./${this.scenePath}skybox/${this.textureResolution}/invisible.png`, // Z+ (out of camera FoV here)
		`./${this.scenePath}skybox/${this.textureResolution}/nz.png`, // Z-
	];

	// POSITION HISTORY (avoid overlaping geometries)
	this.positionHistory = [];

	// MATERIAL ARRAY (store all shaders)
	this.materialShaders = [];

	// FPS COUNTER
	// Off by default, call addFpsCounter method to enable it
	this.fpsCounterIsActive = false;

	/////////////////////////////////////////////////////////////////////////////
	// THREE SCENE BASIS

	// MOUSE/GYRO CONTROLS variables
	this.mouse = new THREE.Vector2();
	this.target = new THREE.Vector2();

	// CLOCK
	this.clock = new THREE.Clock();
	this.time = 0;

	// RENDERER (+ THREE JS CONTAINER)
	this.renderer = new THREE.WebGLRenderer();
	this.renderer.setPixelRatio(window.devicePixelRatio);
	this.renderer.setSize(window.innerWidth, window.innerHeight);
	this.renderer.domElement.id = "retrowaveScene";

	// This lets the user chose where he wants to include the scene. If the id "retrowaveSceneContainer" isn't found in the DOM, it includes it in the body
	let canvas = document.getElementById("retrowaveSceneContainer");
	if (!canvas) {
		document.body.appendChild(this.renderer.domElement);
	}
	else { canvas.appendChild(this.renderer.domElement); }

	// SCENE
	this.scene = new THREE.Scene();
	this.scene.background = new THREE.Color(0x000009);

	// CAMERA
	this.camera = new THREE.PerspectiveCamera(
		75,
		window.innerWidth / window.innerHeight,
		0.1,
		2000
	);
	this.camera.position.set(0, 1.8, 7);
	this.camera.lookAt(this.scene.position);
	this.scene.add(this.camera);
};

/////////////////////////////////////////////////////////////////////////////////
// SCENE PREPARATION
/////////////////////////////////////////////////////////////////////////////////

/**
 * Prepare the scene. Use this method to simplify RetrowaveScene setup
 *
 * @param {boolean} wantProceduralSky Set to true if you want to use the procedural sky (ressource intensive). Default is false (Skybox)
 * @param {boolean} wantAnimation Set to true if you want to start the animation directly. Default is false
 */
RetrowaveScene.prototype.prepareScene = function (
	wantProceduralSky = false,
	wantAnimation = false
) {
	this.autoAdjustOnResize();
	this.addControls();
	this.setPostProcessing();

	if (wantProceduralSky) {
		this.addProceduralSky();
	} else {
		this.addSkybox();
	}

	this.addSvgGraphics();
	this.addFloor();
	this.addSidewalk();
	this.addRoad();
	this.addRoadLines();
	this.addPalmtrees();
	this.addGroupedPyramids();

	if (wantAnimation) {
		this.animate();
	}
};

/////////////////////////////////////////////////////////////////////////////////
// CHANGE ANIMATION SPEED
/////////////////////////////////////////////////////////////////////////////////

/**
 * Change animation speed
 *
 * @param {number} speed The wanted speed. Default is 15
 */
RetrowaveScene.prototype.setAnimationSpeed = function (speed = 15) {
	this.animationSpeed = speed;
	for (let i = 0; i < this.materialShaders.length; i++) {
		this.materialShaders[i].uniforms.speed.value = speed;
	}
};

/////////////////////////////////////////////////////////////////////////////////
// FPS COUNTER
/////////////////////////////////////////////////////////////////////////////////

/**
 * Add and enable THREE FPS counter
 */
RetrowaveScene.prototype.addFpsCounter = function () {
	this.stats = new Stats();
	document.body.appendChild(this.stats.dom);
	this.fpsCounterIsActive = true;
};

/**
 * Remove and disable THREE FPS counter
 */
RetrowaveScene.prototype.removeFpsCounter = function () {
	document.body.removeChild(this.stats.dom);
	this.fpsCounterIsActive = true;
};

/////////////////////////////////////////////////////////////////////////////////
// AUTO-ADJUST ON RESIZE
/////////////////////////////////////////////////////////////////////////////////

/**
 * Event listener to adjust scene width/height according to window size (responsive)
 */
RetrowaveScene.prototype.autoAdjustOnResize = function () {
	window.onresize = onresizefunction.bind(this);
	function onresizefunction() {
		this.width = window.innerWidth;
		this.height = window.innerHeight;

		this.camera.aspect = this.width / this.height;
		this.camera.updateProjectionMatrix();

		this.renderer.setSize(this.width, this.height);
		this.composer.setSize(this.width, this.height);
	}
};

/////////////////////////////////////////////////////////////////////////////////
// POST-PROCESSING
/////////////////////////////////////////////////////////////////////////////////

/**
 * Enable all post-processing effects
 */
RetrowaveScene.prototype.setPostProcessing = function () {
	// RENDER PASS
	this.renderScene = new RenderPass(this.scene, this.camera);

	// BLOOM PASS
	this.renderer.toneMapping = THREE.ReinhardToneMapping; // Necessary for bloom pass (or it gets overexposed), other options available (but all overexposed by default)
	this.renderer.toneMappingExposure = Math.pow(1, 4.0);

	this.bloomPass = new UnrealBloomPass(
		new THREE.Vector2(window.innerWidth, window.innerHeight),
		1.5,
		0,
		0.8
	); // Settings here appear to have no effect

	this.bloomPass.strength = 1.5; // These parameters work just fine
	this.bloomPass.threshold = 0;
	this.bloomPass.radius = 0.8;

	// GLITCH PASS
	this.glitchPass = new GlitchPass();

	// CRT EFFECT (FILM PASS)
	this.effectFilm = new FilmPass(
		0.2, // noise intensity
		0.75, // scanline intensity
		2048, // scanline count
		false // grayscale
	);

	// COMPOSER (MERGE RENDER PASS: Render, Bloom...)
	this.composer = new EffectComposer(this.renderer);
	this.composer.addPass(this.renderScene);
	this.composer.addPass(this.bloomPass);
	this.composer.addPass(this.glitchPass);
	this.glitchPass.enabled = false; // Disables glitch pass by defaults in order to control how often it happens
	this.composer.addPass(this.effectFilm);
};

/////////////////////////////////////////////////////////////////////////////////
// FLOOR
/////////////////////////////////////////////////////////////////////////////////

/**
 * Add the floor (grid) to the scene
 */
RetrowaveScene.prototype.addFloor = function () {
	let floorGeometry = new THREE.PlaneBufferGeometry(300, 300, 0, 0);
	floorGeometry.translate(0, 110, 0);
	floorGeometry.rotateX(-Math.PI * 0.5);
	let floorMaterial = new THREE.MeshBasicMaterial({
		color: 0xff1e99,
	});
	this.createGridMaterial(floorMaterial);

	// Add floor to scene
	this.grid = new THREE.Mesh(floorGeometry, floorMaterial);
	this.scene.add(this.grid);
};

/////////////////////////////////////////////////////////////////////////////////
// ROAD
/////////////////////////////////////////////////////////////////////////////////

/**
 * Add the road (semi-transparent) to the scene
 */
RetrowaveScene.prototype.addRoad = function () {
	let roadGeometry = new THREE.PlaneBufferGeometry(12, 300, 0, 0);
	roadGeometry.translate(0, 110, 0.1);
	roadGeometry.rotateX(-Math.PI * 0.5);

	let roadMaterial = new THREE.MeshBasicMaterial({
		color: 0x03353b,
		transparent: true,
		opacity: 0.7,
	});

	// Add road to scene
	this.road = new THREE.Mesh(roadGeometry, roadMaterial);
	this.scene.add(this.road);
};

/////////////////////////////////////////////////////////////////////////////////
// ROAD LINES
/////////////////////////////////////////////////////////////////////////////////

/**
 * Add road lines to the scene
 */
RetrowaveScene.prototype.addRoadLines = function () {
	let roadLineLeftGeometry = new THREE.PlaneBufferGeometry(0.35, 300, 0, 0);
	roadLineLeftGeometry.translate(-5.2, 110, 0.2);
	roadLineLeftGeometry.rotateX(-Math.PI * 0.5);

	let roadLineRightGeometry = new THREE.PlaneBufferGeometry(0.35, 300, 0, 0);
	roadLineRightGeometry.translate(5.2, 110, 0.2);
	roadLineRightGeometry.rotateX(-Math.PI * 0.5);

	let roadLineCenterLeftGeometry = new THREE.PlaneBufferGeometry(
		0.15,
		300,
		0,
		0
	);
	roadLineCenterLeftGeometry.translate(-1.8, 110, 0.2);
	roadLineCenterLeftGeometry.rotateX(-Math.PI * 0.5);

	let roadLineCenterRightGeometry = new THREE.PlaneBufferGeometry(
		0.15,
		300,
		0,
		0
	);
	roadLineCenterRightGeometry.translate(1.8, 110, 0.2);
	roadLineCenterRightGeometry.rotateX(-Math.PI * 0.5);

	// Merge all road lines geometries
	let roadLinesConception = [];
	roadLinesConception.push(roadLineLeftGeometry);
	roadLinesConception.push(roadLineRightGeometry);
	roadLinesConception.push(roadLineCenterLeftGeometry);
	roadLinesConception.push(roadLineCenterRightGeometry); // Push all geometries into roadLinesConception array

	let roadLinesGeometry = BufferGeometryUtils.mergeBufferGeometries(
		roadLinesConception,
		false
	); // Merge all geometries within sidewalkConception array

	// Material
	let roadLineMaterial = new THREE.MeshBasicMaterial({
		color: 0xffffff,
		transparent: true,
		opacity: 0.3,
	});

	// Add road lines to the scene
	this.roadLines = new THREE.Mesh(roadLinesGeometry, roadLineMaterial);
	this.scene.add(this.roadLines);
};

/////////////////////////////////////////////////////////////////////////////////
// SIDEWALK
/////////////////////////////////////////////////////////////////////////////////

/**
 * Add grid sidewalk to the scene
 */
RetrowaveScene.prototype.addSidewalk = function () {
	let sidewalkTopLeftGeometry = new THREE.PlaneBufferGeometry(8, 300, 0, 0);
	sidewalkTopLeftGeometry.translate(-10, 110, 0.5);
	sidewalkTopLeftGeometry.rotateX(-Math.PI * 0.5);

	let sidewalkSideLeftGeometry = new THREE.PlaneBufferGeometry(0.5, 300, 0, 0);
	sidewalkSideLeftGeometry.translate(0.06, 110, 6);
	sidewalkSideLeftGeometry.rotateX(-Math.PI * 0.5);
	sidewalkSideLeftGeometry.rotateZ(Math.PI * 0.49);

	let sidewalkTopRightGeometry = new THREE.PlaneBufferGeometry(8, 300, 0, 0);
	sidewalkTopRightGeometry.translate(10, 110, 0.5);
	sidewalkTopRightGeometry.rotateX(-Math.PI * 0.5);

	let sidewalkSideRightGeometry = new THREE.PlaneBufferGeometry(0.5, 300, 0, 0);
	sidewalkSideRightGeometry.translate(0.44, 110, -6);
	sidewalkSideRightGeometry.rotateX(-Math.PI * 0.5);
	sidewalkSideRightGeometry.rotateZ(Math.PI * 0.49);

	// Merge all sidewalk geometries
	let sidewalkConception = [];
	sidewalkConception.push(sidewalkTopLeftGeometry);
	sidewalkConception.push(sidewalkSideLeftGeometry);
	sidewalkConception.push(sidewalkTopRightGeometry);
	sidewalkConception.push(sidewalkSideRightGeometry); // Push all geometries into sidewalkConception array

	let sidewalkGeometry = BufferGeometryUtils.mergeBufferGeometries(
		sidewalkConception,
		false
	); // Merge all geometries within sidewalkConception array

	// Sidewalk material (grid)
	let sidewalkMaterial = new THREE.MeshBasicMaterial({
		color: 0x1be9ff,
		side: THREE.DoubleSide,
		transparent: true,
		opacity: 0.8,
	});
	this.createGridMaterial(sidewalkMaterial); // Call function that sets the moving grid shader (common shader between sidewalk and floor, with different color)

	// Add sidewalk to the scene
	this.sidewalk = new THREE.Mesh(sidewalkGeometry, sidewalkMaterial);
	this.scene.add(this.sidewalk);
};

/////////////////////////////////////////////////////////////////////////////////
// GROUPED PYRAMIDS (BETTER PERFORMANCE)
/////////////////////////////////////////////////////////////////////////////////
// Grouping pyramids allow us to run no more than 4 instance at a time versus 120 instances with "addPyramids"
// Reducing instance number helps with performance

RetrowaveScene.prototype.addGroupedPyramids = function () {
	let randomSize, translateX, translateZ, rotatePyramid;

	let pyramidGeometry, pyramidInstance, pyramidMaterial, pyramid;

	let pyramidWireframe, wireframeMaterial;
	// this.randomSize;
	// this.translateX;
	// this.translateZ;
	// this.rotatePyramid;

	this.pyramidGeometry;
	this.pyramidInstance;
	this.pyramidMaterial;
	this.pyramid;

	this.pyramidWireframe;
	this.wireframeMaterial;

	this.pyramidGroupConception = [];

	let minRandomSize, maxRandomSize, minTranslateX, maxTranslateX;

	let minRotatePyramid = 0; // Common values with all pyramids
	let maxRotatePyramid = 2;
	let minTranslateZ = 0;
	let maxTranslateZ = 80;

	for (let i = 0; i < 80; i++) {
		let ignoreGeometry = false;

		if (i < 60) {
			// Furthest
			minRandomSize = 5;
			maxRandomSize = 25;
			minTranslateX = 27;
			maxTranslateX = 120;
		} else if (i >= 60) {
			// Closest pyramids
			minRandomSize = 3;
			maxRandomSize = 8;
			minTranslateX = 10;
			maxTranslateX = 32;
		}

		if (i % 2 == 0) {
			// For left side, make translateX negative as 0 is the center
			minTranslateX *= -1;
			maxTranslateX *= -1;
		}

		randomSize = this.randomize(minRandomSize, maxRandomSize, "int");
		translateX = this.randomize(minTranslateX, maxTranslateX, "float");
		translateZ = this.randomize(minTranslateZ, maxTranslateZ, "float");
		rotatePyramid = this.randomize(minRotatePyramid, maxRotatePyramid, "float");

		this.count = 0;
		let check = checkPyramidHistory.bind(this);
		check();

		function checkPyramidHistory() {
			let checkHistory = this.checkPositionHistory(
				randomSize,
				translateX,
				translateZ
			);
			if (checkHistory == true) {
				this.count++;
				randomSize = this.randomize(minRandomSize, maxRandomSize, "int");
				translateX = this.randomize(minTranslateX, maxTranslateX, "float");
				translateZ = this.randomize(minTranslateZ, maxTranslateZ, "float");
				if (this.count < 5000) {
					// While new values are overlaping with existing pyramids values,
					let check = checkPyramidHistory.bind(this);
					check(); // generate new values and check if they overlap.
				} // If after 10000 checks and random values generated, it still overlap with existing graphics,
				else {
					ignoreGeometry = true; // do not place this geometry.
				}
			}
		}

		// If the geometry found its way onto the position history, add it to the pyramid group. Else, ignore it.
		if (ignoreGeometry == false) {
			pyramidGeometry = new THREE.ConeBufferGeometry(
				randomSize,
				randomSize,
				4,
				1,
				true,
				rotatePyramid
			);
			pyramidGeometry.translate(translateX, 0, translateZ);

			this.positionHistory.push({
				size: randomSize,
				positionX: translateX,
				positionZ: translateZ,
			});

			this.pyramidGroupConception.push(pyramidGeometry);
		}
	}

	let pyramidGroupGeometry = BufferGeometryUtils.mergeBufferGeometries(
		this.pyramidGroupConception,
		false
	); // Merge all geometries within sidewalkConception array

	let pyramidGroupInstance = new THREE.InstancedBufferGeometry();
	pyramidGroupInstance.attributes.position =
		pyramidGroupGeometry.attributes.position;
	pyramidGroupInstance.attributes.uv = pyramidGroupGeometry.attributes.uv;
	pyramidGroupInstance.index = pyramidGroupGeometry.index;
	let pyramidGroupPosition = [];
	pyramidGroupPosition.push(0, 0, 0);
	pyramidGroupPosition.push(0, 0, 260);
	pyramidGroupPosition.push(0, 0, 520);
	pyramidGroupPosition.push(0, 0, 780);

	pyramidGroupInstance.setAttribute(
		"instPosition",
		new THREE.InstancedBufferAttribute(
			new Float32Array(pyramidGroupPosition),
			3
		)
	);

	let pyramidGroupMaterial = new THREE.MeshBasicMaterial({
		color: 0x000000,
	});
	pyramidGroupMaterial.onBeforeCompile = (shader) => {
		this.prepareShader(shader, 950, 800);
	};

	// This needs to be improved...
	let pyramidGroupWireframeMaterial = new THREE.MeshBasicMaterial({
		color: 0x1be9ff,
		wireframe: true,
		polygonOffset: true,
		polygonOffsetFactor: 1,
		polygonOffsetUnits: 1,
	});
	pyramidGroupWireframeMaterial.onBeforeCompile = (shader) => {
		this.prepareShader(shader, 950, 800, 1.01);
	};

	let pyramidGroupMaterials = [
		pyramidGroupMaterial,
		pyramidGroupWireframeMaterial,
	];

	this.pyramidGroups = SceneUtils.createMultiMaterialObject(
		pyramidGroupInstance,
		pyramidGroupMaterials
	);
	this.scene.add(this.pyramidGroups);
};

/////////////////////////////////////////////////////////////////////////////////
// PALMTREES
/////////////////////////////////////////////////////////////////////////////////

RetrowaveScene.prototype.addPalmtrees = function () {
	let palmTreeConception = [];

	// Paltree log
	var logGeometry = new THREE.CylinderBufferGeometry(
		0.25,
		0.125,
		10,
		5,
		4,
		true
	);
	logGeometry.translate(0, 5, 0);
	palmTreeConception.push(logGeometry);
	// Palmtree leaves
	for (let i = 0; i < 35; i++) {
		let leavesGeometry = new THREE.CircleBufferGeometry(1.25, 4);
		leavesGeometry.translate(0, 1.25, 0);
		leavesGeometry.rotateX(-Math.PI * 0.5);
		leavesGeometry.scale(0.25, 1, THREE.Math.randFloat(1, 1.5));
		leavesGeometry.attributes.position.setY(0, 0.25);
		leavesGeometry.rotateX(THREE.Math.randFloatSpread(Math.PI * 0.5));
		leavesGeometry.rotateY(THREE.Math.randFloat(0, Math.PI * 2));
		leavesGeometry.translate(0, 10, 0);
		palmTreeConception.push(leavesGeometry);
	}

	// Merge (log + leaves)
	var palmTree = BufferGeometryUtils.mergeBufferGeometries(
		palmTreeConception,
		false
	);
	palmTree.rotateZ(THREE.Math.degToRad(-1.5));

	var palmTreeInstance = new THREE.InstancedBufferGeometry();
	palmTreeInstance.attributes.position = palmTree.attributes.position;
	palmTreeInstance.attributes.uv = palmTree.attributes.uv;
	palmTreeInstance.index = palmTree.index;
	var palmTreePosition = [];

	for (let i = 0; i < 40; i++) {
		var resultLeft = -this.randomize(20, 80, 1); // Left side
		var resultRight = this.randomize(20, 80, 2); // Right side

		palmTreePosition.push(-10, 0, i * 2 * 15 - 10 - 50);
		palmTreePosition.push(10, 0, i * 2 * 15 - 50);
		palmTreePosition.push(resultLeft, 0, i * 2 * 15 - resultLeft - 50);
		palmTreePosition.push(resultRight, 0, i * 2 * 15 + resultRight - 50);
	}

	palmTreeInstance.setAttribute(
		"instPosition",
		new THREE.InstancedBufferAttribute(new Float32Array(palmTreePosition), 3)
	);

	var palmTreeMaterial = new THREE.MeshBasicMaterial({
		color: 0x056023,
		side: THREE.DoubleSide,
		wireframe: true,
	});

	palmTreeMaterial.onBeforeCompile = (shader) => {
		this.prepareShader(shader, 600, 500, undefined, 0.8, true);
	};

	// Add palm trees to the scene
	var palmTrees = new THREE.Mesh(palmTreeInstance, palmTreeMaterial);
	this.scene.add(palmTrees);
};

/////////////////////////////////////////////////////////////////////////////////
// CHECK POSITION HISTORY
/////////////////////////////////////////////////////////////////////////////////

RetrowaveScene.prototype.checkPositionHistory = function (
	sizeOfGeometry,
	currentPositionX,
	currentPositionZ
) {
	let overlapDetected = false;
	let currentSize;

	if (sizeOfGeometry != undefined) {
		currentSize = sizeOfGeometry; // As X and Z are at the center, we divide the current size by two
	} else {
		currentSize = 1;
	}

	for (let i = 0; i < this.positionHistory.length; i++) {
		if (
			// if current position + current size overlaps with previously set positions (-/+) their own size
			currentPositionX + currentSize >
			this.positionHistory[i].positionX - this.positionHistory[i].size &&
			currentPositionZ + currentSize >
			this.positionHistory[i].positionZ - this.positionHistory[i].size &&
			currentPositionX - currentSize <
			this.positionHistory[i].positionX + this.positionHistory[i].size &&
			currentPositionZ - currentSize <
			this.positionHistory[i].positionZ + this.positionHistory[i].size
		) {
			overlapDetected = true;
		}
	}
	return overlapDetected;
};

/////////////////////////////////////////////////////////////////////////////////
// PROCEDURAL SKY
/////////////////////////////////////////////////////////////////////////////////
// While looking better than the skybox bellow (generated from here), it's actually using much more ressource
// For showcase, procedural sky might be prefered over the skybox, but for real life usage, use the skybox

/**
 * Procedural sky, kinda heavy on ressource
 *
 * Best looking solution, prefer the skybox (addSkybox method) if you're looking for better performance
 */
RetrowaveScene.prototype.addProceduralSky = function () {
	this.radius = 12;
	this.starsGeometry = new THREE.BufferGeometry();

	this.vertices = [];

	this.vertex = new THREE.Vector3();

	for (let i = 0; i < 4000; i++) {
		this.vertex.x = Math.random() * 2 - 1;
		this.vertex.y = Math.random() * 2 - 1;
		this.vertex.z = Math.random() * 2 - 1;
		this.vertex.multiplyScalar(this.radius);

		this.vertices.push(this.vertex.x, this.vertex.y, this.vertex.z);
	}

	this.starsGeometry.setAttribute(
		"position",
		new THREE.Float32BufferAttribute(this.vertices, 3)
	);

	this.stars;
	this.starsMaterials = [
		new THREE.PointsMaterial({
			color: 0x555555,
			size: 2,
			sizeAttenuation: false,
		}),
		new THREE.PointsMaterial({
			color: 0x555555,
			size: 1,
			sizeAttenuation: false,
		}),
		new THREE.PointsMaterial({
			color: 0x333333,
			size: 2,
			sizeAttenuation: false,
		}),
		new THREE.PointsMaterial({
			color: 0x3a3a3a,
			size: 1,
			sizeAttenuation: false,
		}),
		new THREE.PointsMaterial({
			color: 0x1a1a1a,
			size: 2,
			sizeAttenuation: false,
		}),
		new THREE.PointsMaterial({
			color: 0x1a1a1a,
			size: 1,
			sizeAttenuation: false,
		}),
	];

	for (let i = 10; i < 20; i++) {
		this.stars = new THREE.Points(
			this.starsGeometry,
			this.starsMaterials[i % 6]
		);

		this.stars.rotation.x = Math.random() * 6;
		this.stars.rotation.y = Math.random() * 6;
		this.stars.rotation.z = Math.random() * 6;
		this.stars.scale.setScalar(i * 10);

		this.stars.matrixAutoUpdate = false;
		this.stars.updateMatrix();

		this.scene.add(this.stars);
	}
};

/////////////////////////////////////////////////////////////////////////////////
// SKYBOX
/////////////////////////////////////////////////////////////////////////////////

/**
 * Skybox, the least ressource intensive solution for the sky
 *
 * Captured from the procedural sky above using CubemapToEquirectangular (https://github.com/spite/THREE.CubemapToEquirectangular) then converted into a skybox
 */
RetrowaveScene.prototype.addSkybox = function () {
	let loader = new THREE.CubeTextureLoader();
	let texture = loader.load(this.skybox);
	this.scene.background = texture;
};

/////////////////////////////////////////////////////////////////////////////////
// SVG GRAPHICS
/////////////////////////////////////////////////////////////////////////////////

/**
 * This method loads SVG elements and add them to the scene
 *
 * @param {!string} svgUrl URL to your svg file. Mandatory
 * @param {number} positionX X position of your SVG (according to its center). Default is 0
 * @param {number} positionY Y position of your SVG (according to its center). Default is 0
 * @param {number} positionZ Z position of your SVG. Default is 0
 * @param {number} scale Size of your SVG. Default is 0
 * @param {string} objectName Name of your SVG in the scene. Default is 'svg'
 */
RetrowaveScene.prototype.loadSvgGraphics = async function (
	svgUrl,
	positionX = 0,
	positionY = 0,
	positionZ = 0,
	scale = 1,
	objectName = "svg"
) {
	if (svgUrl === null || svgUrl === undefined || svgUrl === "") {
		console.error("You must specify an URL for your SVG file");
	}

	// Function to convert the SVGLoader into a promise loader, as otherwise SVG elements might end-up in a wrong position (ie: city behind the sun)
	function promisifyLoader(loader, onProgress) {
		function promiseLoader(url) {
			return new Promise((resolve, reject) => {
				loader.load(url, resolve, onProgress, reject);
			});
		}

		return {
			originalLoader: loader,
			load: promiseLoader,
		};
	}

	// Convert SVGLoader into a promise, as required
	let promiseLoader = promisifyLoader(new SVGLoader());

	// Await for load, then...
	await promiseLoader
		.load(svgUrl)
		.then((data) => {
			this.svgGroup = new THREE.Group();

			this.paths = data.paths;

			for (var i = 0; i < this.paths.length; i++) {
				this.path = this.paths[i];

				this.fillColor = this.path.userData.style.fill;
				if (this.fillColor !== undefined && this.fillColor !== "none") {
					this.svgMaterial = new THREE.MeshBasicMaterial({
						color: new THREE.Color().setStyle(this.fillColor),
						opacity: this.path.userData.style.fillOpacity,
						transparent: this.path.userData.style.fillOpacity < 1,
						side: THREE.DoubleSide,
						depthWrite: false,
					});

					this.svgShapes = this.path.toShapes(true);

					for (var j = 0; j < this.svgShapes.length; j++) {
						this.svgShape = this.svgShapes[j];

						this.svgGeometry = new THREE.ShapeBufferGeometry(this.svgShape);
						this.svgMesh = new THREE.Mesh(this.svgGeometry, this.svgMaterial);

						this.svgGroup.add(this.svgMesh);
					}
				}
			}

			// Set size and position
			this.svgGroup.position.x = positionX;
			this.svgGroup.position.y = positionY;
			this.svgGroup.position.z = positionZ; //negative value to simplify placement on Z axis
			this.svgGroup.scale.y *= -scale; //negative value to flip horizontaly SVG file as Three.js's SVGLoader loads SVG files upside-down
			this.svgGroup.scale.x *= scale;

			// Get SVG shape size (Width/Height) to center it for easy placement
			this.svgInfo = new THREE.Box3().setFromObject(this.svgGroup);
			this.svgSize = this.svgInfo.getSize();

			// Center SVG shape on X/Y axis
			this.svgGroup.position.x += -this.svgSize.x + this.svgSize.x / 2;
			this.svgGroup.position.y += this.svgSize.y / 2;

			this.svgGroup.name = objectName;
			this.scene.add(this.svgGroup);
		})
		.catch((err) => {
			console.error(err);
		});
};

/**
 * Add SVG graphics to the scene
 *
 * Does not receive any parameters as all urls and settings are set in the class itself
 */
RetrowaveScene.prototype.addSvgGraphics = async function () {
	for (let i = 0; i < this.svgFiles.length; i++) {
		await this.loadSvgGraphics(
			this.svgFiles[i][0],
			this.svgFiles[i][1],
			this.svgFiles[i][2],
			this.svgFiles[i][3],
			this.svgFiles[i][4],
			this.svgFiles[i][5]
		);
	}
};

/////////////////////////////////////////////////////////////////////////////////
// SHADER TOOLBOX
/////////////////////////////////////////////////////////////////////////////////

RetrowaveScene.prototype.createGridMaterial = function (materialVar) {
	materialVar.onBeforeCompile = (shader) => {
		shader.uniforms.speed = {
			value: this.animationSpeed,
		};
		shader.uniforms.time = {
			value: 0,
		};
		shader.vertexShader =
			`
            uniform float speed;
			uniform float time;
			varying vec3 vPos;
			` + shader.vertexShader;
		shader.vertexShader = shader.vertexShader.replace(
			`#include <begin_vertex>`,
			`#include <begin_vertex>

				vec2 tuv = uv;
				float t = time * 0.001 * speed;
				vPos = transformed;
				`
		);
		shader.fragmentShader =
			`
			#extension GL_OES_standard_derivatives : enable

            uniform float speed;
			uniform float time;
			varying vec3 vPos;

			float line(vec3 position, float width, vec3 step){
				vec3 tempCoord = position / step;

				vec2 coord = tempCoord.xz;
				coord.y -= time * speed / 2.;

				vec2 grid = abs(fract(coord - 0.5) - 0.5) / fwidth(coord * width);
				float line = min(grid.x, grid.y);

				return min(line, 1.0);
			}
			` + shader.fragmentShader;
		shader.fragmentShader = shader.fragmentShader.replace(
			`gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,
			`
				float l = line(vPos, 1.0, vec3(2.0)); // grid line width
				vec3 base = mix(vec3(0, 0.75, 0), vec3(0), smoothstep(0., 0., abs(vPos.x))); //ROAD COLOR
				vec3 c = mix(outgoingLight, base, l);
				gl_FragColor = vec4(c, diffuseColor.a);
				`
		);
		this.materialShaders.push(shader);
	};
};

/**
 * Prepare Shader method, made to avoid code repetition
 *
 * @param {object} shader The material you're compiling the shader for
 * @param {number} value1 Distance related
 * @param {number} value2 Distance related
 * @param {string|number} transformedY The scale on Y axis. Default is '1.'. Use a string ended with your number ended with a dot if it's an INT, or simply the value if it's a FLOAT
 * @param {string|number} scale The scale of your object. Default is '3.'. Use a string ended with your number ended with a dot if it's an INT, or simply the value if it's a FLOAT
 * @param {boolean} wantFlip Set to true if you want your objects to be flipped on either sides. Default is false. Only usefull with palm trees
 */
RetrowaveScene.prototype.prepareShader = function (
	shader,
	value1,
	value2,
	transformedY = "1.",
	scale = "3.",
	wantFlip = false
) {
	let transformedX = "";
	if (wantFlip) {
		transformedX = "transformed.x *= sign(instPosition.x);";
	}

	shader.uniforms.speed = {
		value: this.animationSpeed,
	};
	shader.uniforms.time = {
		value: 0,
	};
	shader.vertexShader =
		`
        uniform float speed;
    	uniform float time;
    	attribute vec3 instPosition;
    	` + shader.vertexShader;
	shader.vertexShader = shader.vertexShader.replace(
		`#include <begin_vertex>`,
		`#include <begin_vertex>

            ${transformedX}
    		vec3 ip = instPosition;
    		ip.z = mod(ip.z + time * speed, ${value1}.) - ${value2}.; //ip.z = mod(ip.z + time * 15., 1250.) - 1100.;
            transformed *= ${scale};
            transformed.y *= ${transformedY};
    		transformed += ip;
    		`
	);
	this.materialShaders.push(shader);
};

/////////////////////////////////////////////////////////////////////////////////
// ANIMATION
/////////////////////////////////////////////////////////////////////////////////

RetrowaveScene.prototype.animate = function () {
	// Launch animation
	requestAnimationFrame(this.animate.bind(this));

	this.time += this.clock.getDelta();

	// FPS stats update (only if activated)
	if (this.fpsCounterIsActive) {
		this.stats.update();
	}

	this.materialShaders.forEach((m) => {
		m.uniforms.time.value = this.time;
	});

	this.composer.render();

	this.target.x = (1 - this.mouse.x) * 0.00065; // Those values allow to limit camera (more a workaround than a proper solution)
	this.target.y = (1 - this.mouse.y) * 0.0003;
	//this.target.x = (1 - this.mouse.x) * 0.003;
	//this.target.y = (1 - this.mouse.y) * 0.003;

	this.camera.rotation.x += 0.05 * (this.target.y - this.camera.rotation.x);
	this.camera.rotation.y += 0.05 * (this.target.x - this.camera.rotation.y);
};

// REDUCE GLITCH PASS INTERVAL (by default it runs way too often)
RetrowaveScene.prototype.reduceGlitchPassInterval = function () {
	if (this.glitchPass.enabled == false) {
		// Enables glitch pass every 30 seconds
		let timeout = setTimeout(enableGlithPass.bind(this), 30000);

		function enableGlithPass() {
			this.glitchPass.enabled = true;
			this.reduceGlitchPassInterval();
		}
	} else if (this.glitchPass.enabled == true) {
		// Disables glitch pass after 5 seconds
		let timeout = setTimeout(disableGlithPass.bind(this), 5000);

		function disableGlithPass() {
			this.glitchPass.enabled = false;
			this.reduceGlitchPassInterval();
		}
	}
};

/////////////////////////////////////////////////////////////////////////////////
// CAMERA CONTROLS
/////////////////////////////////////////////////////////////////////////////////
// Mouse on PC, motion on mobile

RetrowaveScene.prototype.addControls = function () {
	// Event listener to move camera according to mouse position
	document.addEventListener("mousemove", onMouseMove.bind(this), false);

	if (window.DeviceOrientationEvent) {
		window.addEventListener(
			"deviceorientation",
			motionControls.bind(this),
			false
		);
	}

	// MOUSEMOUVE MOVES CAMERA FUNCTION
	function onMouseMove(event) {
		this.mouse.x = event.clientX - window.innerWidth / 2;
		this.mouse.y = event.clientY - window.innerHeight / 2;
	}

	function motionControls(event) {
		this.y = -event.beta; // -180° -> 180° / rotation arround x axis, so it affects y axis here
		this.x = -event.gamma; // -90° -> 90° / rotation arround y axis, so it affects x axis here

		if (this.x > 90) {
			this.x = 90;
		}
		if (this.x < -90) {
			this.x = -90;
		}
		if (this.y > 90) {
			this.y = 90;
		}
		if (this.y < -90) {
			this.y = -90;
		}

		if (window.innerHeight > window.innerWidth) {
			// Portrait mode
			this.mouse.x = this.x * 20;
			this.mouse.y = (30 + this.y) * 20;
		} // Landscape mode
		else {
			this.mouse.x = this.y * 40;
			this.mouse.y = -(30 + this.x) * 15;
		}
	}
};

/////////////////////////////////////////////////////////////////////////////////
// RANDOMIZER
/////////////////////////////////////////////////////////////////////////////////
// Method to obtain random numbers (int, float, odd or even) according to its settings

RetrowaveScene.prototype.randomize = function (min, max, setting) {
	let randomResult;

	if (setting == "float") {
		// Get random float
		randomResult = Math.random() * (max - min + 1) + min;

		if (randomResult == this.previousRandomFloat) {
			do {
				randomResult = Math.random() * (max - min + 1) + min;
			} while (randomResult == this.previousRandomFloat);
			this.previousRandomFloat = randomResult;
		}
	} else if (setting == "int") {
		// Get random integer
		randomResult = Math.floor(Math.random() * (max - min + 1)) + min;

		if (randomResult == this.previousRandomInteger) {
			do {
				randomResult = Math.floor(Math.random() * (max - min + 1)) + min;
			} while (randomResult == this.previousRandomInteger);
			this.previousRandomInteger = randomResult;
		}
	} else if (setting == 1 || setting == 2) {
		// Get random integer (Odd or Even)
		randomResult = Math.floor(Math.random() * (max - min + 1)) + min;

		if (
			randomResult == this.previousOddRandomInteger ||
			randomResult == this.previousEvenRandomInteger
		) {
			if (setting == 1) {
				if (
					randomResult < this.previousOddRandomInteger + 1 &&
					randomResult > this.previousOddRandomInteger - 1
				) {
					do {
						randomResult = Math.floor(Math.random() * (max - min + 1)) + min;
					} while (
						randomResult < this.previousOddRandomInteger + 1 &&
						randomResult > this.previousOddRandomInteger - 1
					);
				}

				this.previousOddRandomInteger = randomResult;
			} else if (setting == 2) {
				if (
					randomResult < this.previousEvenRandomInteger + 1 &&
					randomResult > this.previousEvenRandomInteger - 1
				) {
					do {
						randomResult = Math.floor(Math.random() * (max - min + 1)) + min;
					} while (
						randomResult < this.previousEvenRandomInteger + 1 &&
						randomResult > this.previousEvenRandomInteger - 1
					);
				}

				this.previousEvenRandomInteger = randomResult;
			}
		}
	}

	return randomResult;
};
