import { Box, Container, Grid } from "@mui/material";

import { Toolbar, Typography } from "@mui/material";
import CirclePacking from "./canvas/circlePacking";
import OverlayedCanvas from "./canvas";
import CirclePackingOverlay from "./canvas/circlePacking/overlay";

import defaultTheme from "./assets/themes/default";

function Home(props) {

    return (
        <Box component="main" sx={{ flexGrow: 1, p: 0 }}>
            {/* <Toolbar /> */}
            <div>
                <OverlayedCanvas
                    canvas={<CirclePacking />}
                    overlayElement={
                        <CirclePackingOverlay />
                    }
                />
            </div>

            <Box sx={{
                p: 4,
            }}>
                <Grid container spacing={4}>
                    <Grid item xs={12} md={5}>
                        <Typography variant='h2' color="secondary">
                            Me, Myself & Ahmad
                        </Typography>
                        <Container
                            sx={{
                                p: 4
                            }}
                        >
                        <Typography color="primary" paragraph justifyContent='center'>
                            Ahmad is an enthusiast student for life, with an artistic mind that is always looking 
                            to understand and solve problems using visualization techniques.
                            He likes to learn, read books and make sketches of people and sometimes Urdu poetry.
                        </Typography>
                        <Typography color="primary" paragraph justifyContent='center'>
                            Software Engineer by profession and Problem Solver by heart, 
                            Ahmad is currently employed at Arbisoft, creating web apps with Python-Django and React.
                        </Typography>
                        <Typography color="primary" paragraph justifyContent='center'>
                            Talk to me about spirituality, life or tell me a story.
                        </Typography>
                        </Container>
                    </Grid>
                    <Grid item xs={12} md={7}>
                        <Typography color={defaultTheme.palette.tertiary.main} paragraph>
                            Consequat mauris nunc congue nisi vitae suscipit. Fringilla est ullamcorper
                            eget nulla facilisi etiam dignissim diam. Pulvinar elementum integer enim
                            neque volutpat ac tincidunt. Ornare suspendisse sed nisi lacus sed viverra
                            tellus. Purus sit amet volutpat consequat mauris. Elementum eu facilisis
                            sed odio morbi. Euismod lacinia at quis risus sed vulputate odio. Morbi
                            tincidunt ornare massa eget egestas purus viverra accumsan in. In hendrerit
                            gravida rutrum quisque non tellus orci ac. Pellentesque nec nam aliquam sem
                            et tortor. Habitant morbi tristique senectus et. Adipiscing elit duis
                            tristique sollicitudin nibh sit. Ornare aenean euismod elementum nisi quis
                            eleifend. Commodo viverra maecenas accumsan lacus vel facilisis. Nulla
                            posuere sollicitudin aliquam ultrices sagittis orci a.
                        </Typography>
                    </Grid>
                </Grid>
            </Box>
        </Box>
    )
}

export default Home;