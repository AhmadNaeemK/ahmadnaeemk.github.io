import './App.css';
import { Box } from '@mui/system';
import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles'

// theme
import defaultTheme from './components/assets/themes/default'

// react router
import { Routes, Route } from 'react-router-dom'

// redux imports 
import { Provider } from 'react-redux'
import store from './app/store'

// project imports
import Sidebar from './components/layout/sidebar/index.js';
import NavBar from './components/layout/navbar';
import Home from './components/home';
import Blog from './components/blog';

function App() {
  return (
    <Provider store={store}>
      <ThemeProvider theme={defaultTheme}>
        <Box sx={{ display: 'flex' }}>
          < CssBaseline />
          <NavBar />
          <Sidebar />
          <Routes>
            <Route path='/' element={<Home />} />
            <Route path='/blog/' element={<Blog />} />
          </Routes>
        </Box>
      </ThemeProvider>
    </Provider>
  );
}

export default App;
