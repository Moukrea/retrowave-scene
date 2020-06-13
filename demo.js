"use strict";

import { RetrowaveScene } from "./retrowave_scene.js";

document.addEventListener("DOMContentLoaded", loadComplete);

function loadComplete() {
	var retrowaveScene = new RetrowaveScene();
	//retrowaveScene.setAnimationSpeed( 2 );
	// await retrowaveScene.addSvgGraphics( 'sun', 'js/retrowave_files/sun.svg', 0, 40, -500, 0.11 );
	// await retrowaveScene.addSvgGraphics( 'cityFar', 'js/retrowave_files/city_far.svg', 0, 15, -450, 0.4 );
	// await retrowaveScene.addSvgGraphics( 'cityClose', 'js/retrowave_files/city_close.svg', 0, 28, -300, 0.2 );
	// retrowaveScene.addRenderer();
	// retrowaveScene.addFpsCounter();
	// retrowaveScene.addSvgGraphics();
	// retrowaveScene.setPostProcessing();
	// retrowaveScene.reduceGlitchPassInterval();
	// retrowaveScene.addSkybox();
	// retrowaveScene.addFloor();
	// retrowaveScene.addRoad();
	// retrowaveScene.addRoadLines();
	// retrowaveScene.addSidewalk();
	// retrowaveScene.addGroupedPyramids();
	// //retrowaveScene.addPyramids();
	// retrowaveScene.addPalmtrees();
	// retrowaveScene.addControls();
	// retrowaveScene.animate();
	// retrowaveScene.autoAdjustOnResize();
	retrowaveScene.prepareScene(false, true);
}
