import { Grid, Typography } from "@mui/material";
import React from "react";

import { ReactComponent as Html5Icon } from '../../assets/svgs/html5.svg'
import { ReactComponent as CSS3Icon } from '../../assets/svgs/css3.svg'
import { ReactComponent as JsIcon } from '../../assets/svgs/javascript.svg'
import { ReactComponent as PythonIcon } from '../../assets/svgs/python.svg'
import { ReactComponent as ReactIcon } from '../../assets/svgs/react.svg'
import { ReactComponent as BootStrapIcon } from '../../assets/svgs/bootstrap.svg'
import { ReactComponent as MuiIcon } from '../../assets/svgs/mui.svg'
import { ReactComponent as MySqlIcon } from '../../assets/svgs/mysql.svg'
import { ReactComponent as ReduxIcon } from '../../assets/svgs/redux.svg'
import { ReactComponent as SassIcon } from '../../assets/svgs/sass.svg'
import { ReactComponent as DjangoIcon } from '../../assets/svgs/django.svg'
import { ReactComponent as TensorFlowIcon } from '../../assets/svgs/tensorFlow.svg'

const technologies = [
    { title: "Html5", icon: <Html5Icon /> },
    { title: "CSS3", icon: <CSS3Icon /> },
    { title: "JavaScript", icon: <JsIcon /> },
    { title: "Python", icon: <PythonIcon /> },
    { title: "React", icon: <ReactIcon /> },
    { title: "Redux", icon: <ReduxIcon /> },
    { title: "Bootstrap", icon: <BootStrapIcon /> },
    { title: "Material UI", icon: <MuiIcon /> },
    { title: "Sass", icon: <SassIcon /> },
    { title: "MySql", icon: <MySqlIcon /> },
    { title: "Django", icon: <DjangoIcon /> },
    { title: "TensorFlow", icon: <TensorFlowIcon /> },
]

const TechnologyItem = (props) => {
    return (
        <>
            {props.icon}
            <Typography color="primary">
                {props.title}
            </Typography>
        </>
    )
}

const Technologies = (props) => {

    return (
        <>
            {technologies.map((technology, index) => (
                <Grid key={technology.title} item xs={4} md={3} sx={{
                    textAlign: "center",
                    p: '0px',
                    marginY: {xs: "5px", md: "10px"}
                }}>
                    <TechnologyItem icon={technology.icon} title={technology.title} />
                </Grid>
            ))
            }
        </>
    )
}

export default Technologies