import React from 'react'
import Sketch from 'react-p5'
import DotsBackground from './background';
import CirclePackingScene from './circlePackingScene';

function CirclePacking(props) {

    const fontPath = './fonts/MontserratBold.otf'

    let canvasDiv;
    let textFont;
    
    let scene, background;

    const preload = (p5) => {
        textFont = p5.loadFont(fontPath);
    }

    const setup = (p5, canvasParentRef) => {

        canvasDiv = document.getElementById('circlePackingCanvas');
        p5.createCanvas(canvasDiv.offsetWidth, 500).parent(canvasParentRef);

        background = new DotsBackground(p5);
        scene = new CirclePackingScene(p5, textFont, "ahmad");
    };

    const draw = (p5) => {
        p5.background(20);

        scene.show();
        scene.update();

        background.show();
        background.update();
    };

    const windowResized = (p5) => {
        canvasDiv = document.getElementById('circlePackingCanvas')
        p5.resizeCanvas(canvasDiv.offsetWidth, 500)
        scene = new CirclePackingScene(p5, textFont, "ahmad")
    }

    return (
        <div id='circlePackingCanvas'>
            <Sketch setup={setup} draw={draw} windowResized={windowResized} preload={preload} />
        </div>
    );
}

export default CirclePacking;