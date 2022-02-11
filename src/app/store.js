import { configureStore, applyMiddleware } from '@reduxjs//toolkit'
import thunk from 'redux-thunk'

// slices
import sidebarToggleReducer from '../features/domstates/sidebarToggleSlice'

export default configureStore({
    reducer: {
        sidebarToggle: sidebarToggleReducer
    }
}, applyMiddleware(thunk))