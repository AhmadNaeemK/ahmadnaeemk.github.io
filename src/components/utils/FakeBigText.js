import { styled } from "@mui/system";

const FakeBigText = styled('div')`
    z-index: -1;
    font-family: 'Archivo Black';
    font-size: 20rem;
    color: rgba(255,255,255,0.03);
    position: absolute;
    overflow: hidden;
    @media only screen and (max-width:768px){
        font-size: 8rem;
    }
`

export default FakeBigText;
