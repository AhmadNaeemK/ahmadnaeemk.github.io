import { styled } from "@mui/system"

const CPOverlayDiv = styled('div')`
    position: absolute;
    color: white;
    font-size: x-large;
    left: 50%;
    top: 30%;
    transform: translate(-50%, -50%);
    text-align: center;
`

function CirclePackingOverlay(props) {

    return (
        <CPOverlayDiv>
            <h1>
                I am
            </h1>
        </CPOverlayDiv>
    )

}

export default CirclePackingOverlay;