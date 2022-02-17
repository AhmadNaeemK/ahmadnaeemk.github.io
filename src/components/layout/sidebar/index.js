import React from 'react'

import { Link } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import { useSelector, useDispatch } from 'react-redux';
import { toggleSideBar } from '../../../features/domstates/sidebarToggleSlice';

import { Box } from '@mui/system';
import { Drawer } from '@mui/material';
import { List, ListItem, ListItemText } from '@mui/material';
import { IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';

const drawerWidth = 100;

const NavItems = [
  { title: 'About', link: '/' },
  { title: 'Blog', link: '/blog/' },
]

function Sidebar(props) {
  const { window } = props;
  const container = window !== undefined ? () => window().document.body : undefined;

  const mobileOpen = useSelector((state) => state.sidebarToggle.open);
  const dispatch = useDispatch();

  const drawer = (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }}
    >
      <List>
        {NavItems.map((item, index) => (
          <ListItem button key={item.title + index}>
            <Link
              component={RouterLink}
              to={item.link}
              underline="none"
            >
              <ListItemText primary={item.title} />
            </Link>
          </ListItem>
        ))}
        <ListItem button key={1} onClick={() => { dispatch(toggleSideBar()) }}>
          <ListItemText primary={"asda"} />
        </ListItem>
      </List>
    </div>
  );

  return (
    <Box
      component="nav"
      sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 }, overflow: 'auto' }}
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
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: '100%' },
        }}
      >
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="end"
          onClick={() => { dispatch(toggleSideBar()) }}
          sx={{ mr: 2, display: { sm: 'none' } }}
        >
          <MenuIcon />
        </IconButton>
        {drawer}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
        }}
        open
      >
        {drawer}
      </Drawer>
    </Box>
  )
}

export default Sidebar