import React from 'react'

import logoImg from '../../assets/images/logo.png'

import { Link } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import { useSelector, useDispatch } from 'react-redux';
import { toggleSideBar } from '../../../features/domstates/sidebarToggleSlice';

import { Box, styled } from '@mui/system';
import { Drawer } from '@mui/material';
import { List, ListItem, ListItemText } from '@mui/material';
import { IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';

const drawerWidth = 120;

const NavItems = [
  { title: 'About', link: '/' },
  { title: 'Blog', link: '/blog/' },
]

const DrawerDiv = styled('div')`
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%,-50%);
    border-top: 1px solid #333;
    width: 100%;
  `

function Sidebar(props) {
  const { window } = props;
  const container = window !== undefined ? () => window().document.body : undefined;

  const mobileOpen = useSelector((state) => state.sidebarToggle.open);
  const dispatch = useDispatch();

  const drawer = (
    <DrawerDiv>
      <List
        sx={{
          paddingTop: '0'
        }}
      >
        {NavItems.map((item, index) => (
          <ListItem button key={item.title + index}
            sx={{
              borderBottom: "1px solid",
              borderColor: "#333",
              justifyContent: 'center'
            }}
          >
            <Link
              component={RouterLink}
              to={item.link}
              underline="none"
            >
              <ListItemText primary={item.title} />
            </Link>
          </ListItem>
        ))}
      </List>
    </DrawerDiv>
  );

  const logo = (
    <img src={logoImg} style={{
      width: '100px', height: '100px', marginTop: '10px'
    }} />
  );

  return (
    <Box
      component="nav"
      sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 }, overflow: 'auto', alignItems:'center' }}
    >
      < Drawer
        container={container}
        variant="temporary"
        open={mobileOpen}
        onClose={() => dispatch(toggleSideBar())}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          display: { xs: 'block', sm: '100%' }, 
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: '100%', alignItems:'center',},
        }}
      >
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="end"
          onClick={() => { dispatch(toggleSideBar()) }}
          sx={{
            display: { sm: 'none' },
            color: "white",
          }}
        >
          <MenuIcon />
        </IconButton>
        {logo}
        {drawer}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, alignItems:'center', },
        }}
        open
      > 
        {logo}
        {drawer}
      </Drawer>
    </Box>
  )
}

export default Sidebar