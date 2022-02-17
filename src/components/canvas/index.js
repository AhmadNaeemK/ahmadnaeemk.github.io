import { styled } from "@mui/system";

const OverlayedCanvasContainer = styled('div')`

    position: relative

    .react-p5 {
        position: absolute;
    };

    #overlay{
        position: absolute;
    }

`

function OverlayedCanvas(props) {
    return (
        < OverlayedCanvasContainer>
            <div id="overlay">
                {props.overlayElement}
            </div>
            {props.canvas}
        </OverlayedCanvasContainer>
    )
}

export default OverlayedCanvas;