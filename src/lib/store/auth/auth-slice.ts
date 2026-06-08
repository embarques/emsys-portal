import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type AuthTransportState = {
  idToken: string | null;
  companyId: string | null;
};

const initialState: AuthTransportState = {
  idToken: null,
  companyId: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuthTransport: (state, action: PayloadAction<AuthTransportState>) => {
      state.idToken = action.payload.idToken;
      state.companyId = action.payload.companyId;
    },
    clearAuthTransport: (state) => {
      state.idToken = null;
      state.companyId = null;
    },
  },
});

export const { setAuthTransport, clearAuthTransport } = authSlice.actions;
export default authSlice.reducer;
