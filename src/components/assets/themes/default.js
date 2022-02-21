import { createTheme, responsiveFontSizes } from '@mui/material/styles'

let defaultTheme = createTheme({

    typography: {

        h1: {
            fontFamily: 'Archivo Black'
        },
        h2: {
            fontFamily: 'Archivo Black',
        }
    },

    palette: {
        primary: {
            main: '#fff'
        },
        secondary: {
            main: '#32e3e0'
        },
        tertiary: {
            main: '#2cc941'
        },

        background: {
            default: '#141414',
            paper: '#161616'
        }
    },
})

defaultTheme = responsiveFontSizes(defaultTheme)

export default defaultTheme;
