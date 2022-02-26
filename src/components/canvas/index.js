import { styled } from "@mui/system";
import { Box } from "@mui/system";

const OverlayedCanvasContainer = styled('div')`

    position: relative;

    #overlay{
        position: absolute;
        width: 100%;
        height: 100%;
    }

`

function OverlayedCanvas(props) {
    return (
        < OverlayedCanvasContainer>
            <Box id="overlay">
                {props.overlayElement}
            </Box>
            {props.canvas}
        </OverlayedCanvasContainer>
    )
}

export default OverlayedCanvas;