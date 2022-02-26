import { createSlice } from "@reduxjs/toolkit";

export const sidebarToggleSlice = createSlice({
    name: 'sidebarToggle',
    initialState: {
        open: false
    },
    reducers: {
        toggleSideBar: (state) => {
            state.open = !state.open
        }
    }
})

export const {toggleSideBar} = sidebarToggleSlice.actions;
export default sidebarToggleSlice.reducer;
