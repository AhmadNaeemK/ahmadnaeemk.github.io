import { Typography, Container } from "@mui/material";

const AboutMe = (props) => {
    return (
        <>
            <Typography variant='h2' color="secondary">
                Me, Myself & Ahmad
            </Typography>
            <Container
                sx={{
                    p:{ xs: 1,md: 4 }
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
        </>
        )
}

export default AboutMe;
