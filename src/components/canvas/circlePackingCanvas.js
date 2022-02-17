import React from 'react'
import Sketch from 'react-p5'

function CirclePacking(props) {

    let x = 0
    let y = 200

    const setup = (p5, canvasParentRef) => {
        // use parent to render the canvas in this ref
        // (without that p5 will render the canvas outside of your component)
        p5.createCanvas(p5.windowWidth - p5.windowWidth / 10, 500).parent(canvasParentRef);
    };

    const draw = (p5) => {
        p5.background(0);
        p5.ellipse(x, y, 70, 70);
        // NOTE: Do not use setState in the draw function or in functions that are executed
        // in the draw function...
        // please use normal variables or class properties for these purposes
        x++;
        if (x > p5.width) {
            x = 0;
        };
    };

    const windowResized = (p5) => {
        p5.resizeCanvas(p5.windowWidth - p5.windowWidth / 10, 500)
        console.log(p5.windowWidth)
    }

    return <Sketch setup={setup} draw={draw} windowResized={windowResized}/>;
}

export default CirclePacking;