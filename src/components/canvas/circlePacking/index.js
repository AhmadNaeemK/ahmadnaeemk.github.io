import React from 'react'
import Sketch from 'react-p5'
import DotsBackground from './background';
import CirclePackingScene from './circlePackingScene';

import { Box } from '@mui/material'

const CirclePacking = (props) => {

    const fontPath = './fonts/MontserratBold.otf'

    let canvasDiv;

    const [scene, setScene] = React.useState(null)
    const [background, setBackground] = React.useState(null)
    const [textFont, setTextFont] = React.useState(null)

    const preload = (p5) => {
        setTextFont(p5.loadFont(fontPath));
    }

    const setup = (p5, canvasParentRef) => {
        canvasDiv = document.getElementById('circlePackingCanvas');
        p5.createCanvas(canvasDiv.offsetWidth, Math.max(canvasDiv.offsetHeight, canvasDiv.offsetWidth / 2)).parent(canvasParentRef);
        setBackground(new DotsBackground(p5));
        setScene( new CirclePackingScene(p5, textFont, "ahmad") );
    };

    const draw = (p5) => {
        p5.background(20);

        background.show();
        background.update();

        scene.show();
        scene.update();
    };

    return (
        <Box component='div' id='circlePackingCanvas' sx={{
            width: '100%',
            minHeight: '500px'
        }}>
            <Sketch setup={setup} draw={draw} preload={preload} />
        </Box>
    );
}

export default CirclePacking;