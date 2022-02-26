import { Box, Grid, Typography } from "@mui/material"
import LinearProgress from '@mui/material/LinearProgress';
import defaultTheme from "./assets/themes/default";

const Loading = (props) => {


    return (
        <Box component="main" sx={{ flexGrow: '1' }}>
            <Grid
                container
                spacing={0}
                direction="column"
                alignItems="center"
                justifyContent="center"
                style={{ minHeight: '100vh' }}
            >
                <Grid item xs={12} sx={{
                    width: '50%',
                }}>
                    <Typography variant='h1' color='primary'>
                        ahmad
                    </Typography>
                    <LinearProgress
                        sx={{
                            '& .MuiLinearProgress-bar': {
                                background: `linear-gradient(90deg, ${defaultTheme.palette.secondary.main}, ${defaultTheme.palette.tertiary.main} 100%)`
                            },

                            height: '2px', borderRadius: 5,
                            backgroundColor: '#0a0a0a',
                        }}
                    />
                    <Typography variant='h1' color='primary' sx ={{textAlign: 'right'}}>
                        naeem
                    </Typography>
                </Grid>

            </Grid>
        </Box >
    )
}

export default Loading