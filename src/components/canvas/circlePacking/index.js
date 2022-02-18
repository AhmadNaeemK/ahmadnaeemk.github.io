import { Translate } from '@mui/icons-material'
import { popoverClasses } from '@mui/material'
import React from 'react'
import Sketch from 'react-p5'

import Dot from './dot'

function CirclePacking(props) {


    let dots = []
    let attempts = 0

    const fontSize = 150;
    const fontPath = './fonts/MontserratBold.otf'

    let text = "ahmad";
    let textPoints, textBounds;
    let textFont;

    const preload = (p5) => {
        textFont = p5.loadFont(fontPath)
    }

    const setup = (p5, canvasParentRef) => {
        // use parent to render the canvas in this ref
        // (without that p5 will render the canvas outside of your component)
        p5.createCanvas(p5.windowWidth - p5.windowWidth / 10, 500).parent(canvasParentRef);
        textPoints = textFont.textToPoints(text, 100, 200, fontSize, {
            sampleFactor: 0.25,
            simplifyThreshold: 0,
        })
        textBounds = textFont.textBounds(text, 0, 0, fontSize)
    };

    const draw = (p5) => {
        p5.background(0);
        p5.push()
        p5.translate(100,100)
        for (let dot of dots) {
            if (!dot.checkCanvasEdge() && !dot.checkDotsEdge(dots)) {
                dot.grow()
            }
            dot.show()
        }
        let newPoint = textPoints[p5.floor(p5.random(textPoints.length))]
        let newDot = new Dot(p5, newPoint.x, newPoint.y, 1 / 2, true)
        if (!newDot.checkCanvasEdge() && !newDot.checkDotsEdge(dots) ) {
            dots.push(newDot);
            attempts = 0;
        } else attempts++;

        if (attempts > 100 || textPoints.length <= 0) {
            p5.noLoop();
            attempts = 0;
        }
        p5.pop()
    };

    const windowResized = (p5) => {
        p5.resizeCanvas(p5.windowWidth - p5.windowWidth / 10, 500)
    }

    return <Sketch setup={setup} draw={draw} windowResized={windowResized} preload={preload} />;
}

export default CirclePacking;