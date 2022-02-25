import { Box, Grid, Typography, Container, Toolbar } from "@mui/material";

import CirclePacking from "./canvas/circlePacking";
import OverlayedCanvas from "./canvas";
import CirclePackingOverlay from "./canvas/circlePacking/overlay";

import AsyncImage from "./utils/AsyncImage";

// content
import AboutMe from "./content/home/aboutMe";
import FakeBigText from "./utils/FakeBigText";
import Seperator from "./utils/seperator";
import Technologies from "./content/home/technologies";
import ContactMe from "./content/home/contactMe";

function Home(props) {

    return (
        <Box component="main" sx={{ flexGrow: 1, p: 0 }}>
            <OverlayedCanvas
                canvas={<CirclePacking />}
                overlayElement={
                    <CirclePackingOverlay />
                }
            />

            <Box component='section' sx={{
                p: 4,
            }}>
                <Grid container rowSpacing={1} columnSpacing={4} sx={{
                    overflowX: 'hidden'
                }}>
                    <Grid item xs={12} md={5}>
                        <AboutMe />
                    </Grid>
                    <Grid item xs={12} md={7}>
                        <Box component='div'
                            sx={{
                                transform: { xs: 'none', md: 'skewX(-20deg)' },
                                overflow: 'hidden',
                                borderRadius: '8px',
                            }}
                        >
                            <AsyncImage
                                src="https://drive.google.com/uc?export=view&id=1vWjUmtxt6z_X_oSoP-u_eo3U-nNSmZCi"
                                alt="ahmad"
                                sx={{
                                    WebkitBoxReflect: 'below -0px linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.05))',
                                    transform: { xs: 'scaleX(-1) scale(1.25)', md: 'skewX(20deg) scaleX(-1) scale(1.25)' },
                                    objectPosition: '10% 22%',
                                    filter: 'grayscale(50%)'
                                }}
                            />
                        </Box>
                    </Grid>
                </Grid>
            </Box>

            <Seperator />

            <Box component='section' sx={{
                p: { xs: 4, md: 6 },
                position: 'relative'
            }}>
                <FakeBigText sx={{
                    top: { xs: '-10%', md: '-30%' },
                    left: '-5%',
                }}>
                    Tech
                </FakeBigText>
                <Box component='div'>
                    <Container
                        maxWidth='xlg'
                        sx={{
                            textAlign: 'right',
                        }}
                    >
                        <Typography variant="h2" color="secondary">Technologies I Work With</Typography>
                    </Container>
                    <Container
                        maxWidth='xlg'
                        sx={{
                            marginY: '50px',
                        }}
                    >
                        <Grid container rowSpacing={1} columnSpacing={4}>
                            <Technologies />
                        </Grid>
                    </Container>
                </Box>
            </Box>

            <Seperator />

            <Box component='section' sx={{
                p: { xs: 4, md: 6 },
            }}>

                <Grid container >
                    <Grid item xs={12} md={4} textAlign='center'>
                        <Box component='div'>
                            <Typography variant='h2' color='secondary' >
                                Contact Me
                            </Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <AsyncImage
                            src="https://drive.google.com/uc?export=view&id=16Ik3OWD8XXYJ4GiB8JAN8qTEOxzcQw5P"
                            alt="ahmad"
                            sx={{
                                width: { xs: '200px', md: 'min-content' }
                            }}
                        />
                    </Grid>

                    <Grid item xs={12} md={4} sx={{
                        position:'relative'
                    }}>
                        <Box component='div' sx={{
                            bottom: '0px',
                            left: '10%',
                            position: { xs:'initial', md:'absolute'},
                        }}>
                            <ContactMe />
                        </Box>
                    </Grid>
                    <Grid item xs={1}> </Grid>
                </Grid>
            </Box>

        </Box >
    )
}

export default Home;