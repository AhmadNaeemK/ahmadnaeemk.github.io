import { Link, Typography, Box, Stack, } from "@mui/material"
import Seperator from "../../utils/seperator";

import { ReactComponent as InstagramIcon } from '../../assets/svgs/instagram.svg'
import { ReactComponent as GithubIcon } from '../../assets/svgs/github.svg'
import { ReactComponent as LinkedinIcon } from '../../assets/svgs/linkedin.svg'

const ContactMe = (props) => {

    const socialLinks = [
        { title: 'github', icon: <GithubIcon style={{ width: '50px', height: '50px' }} />, link: 'https://github.com/AhmadNaeemK' },
        { title: 'instagram', icon: <InstagramIcon style={{ width: '50px', height: '50px' }} />, link: 'https://www.instagram.com/ahm3dnaeem/' },
        { title: 'linkedIn', icon: <LinkedinIcon style={{ width: '50px', height: '50px' }} />, link: 'https://www.linkedin.com/in/muhammad-ahmad-naeem-aa2614185' },
    ]

    return (
        <Box component='div' style={{ margin: 'auto', textAlign: 'center' }}>
            <div style={{
                margin: '20px', p: '10px'
            }}>
                <Link href='mailto:ahmadnaeemk12@gmail.com' underline='none'>
                    <Typography variant='h6' color={'primary'}> ahmadnaeemk12@gmail.com </Typography>
                </Link>
            </div>
            <Seperator />
            <div style={{ width: 'min-content', margin: 'auto', marginTop:'20px' }}>
                <Stack direction="row" spacing={2}>
                    {socialLinks.map((social, index) => (
                        <Link href={social.link} key={social.title}>
                            <div>
                                {social.icon}
                            </div>
                        </Link>
                    ))}
                </Stack>
            </div>
        </Box>
    )
}

export default ContactMe;