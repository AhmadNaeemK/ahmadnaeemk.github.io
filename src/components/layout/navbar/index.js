import { AppBar, Toolbar } from "@mui/material";
import { IconButton} from "@mui/material";
import MenuIcon from '@mui/icons-material/Menu';

import { useDispatch } from "react-redux";
import { toggleSideBar } from '../../../features/domstates/sidebarToggleSlice';

function NavBar(props) {

    const dispatch = useDispatch();

    return (
        <AppBar
            position="fixed"
            color = 'transparent'
            sx={{ 
                zIndex: (theme) => theme.zIndex.drawer,
                color: "white",
                boxShadow: 'none',
            }}
        >
            <Toolbar>
                <IconButton
                    color="inherit"
                    aria-label="open drawer"
                    edge="end"
                    onClick={() => {dispatch(toggleSideBar())}}
                    sx={{ mr: 2, display: { sm: 'none' }, color:"white",}}
                >
                    <MenuIcon />
                </IconButton>
            </Toolbar>
        </AppBar>
    )
}

export default NavBar