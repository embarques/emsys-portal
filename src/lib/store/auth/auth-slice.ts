import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type AuthTransportState = {
  idToken: string | null;
  companyId: string | null;
  actorId: string | null;
  /** Changes on login/logout/actor/company transitions, not ordinary token renewal. */
  contextVersion: number;
};

const initialState: AuthTransportState = {
  idToken: null,
  companyId: null,
  actorId: null,
  contextVersion: 0,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuthTransport: (state, action: PayloadAction<Omit<AuthTransportState, "contextVersion">>) => {
      if (state.companyId !== action.payload.companyId || state.actorId !== action.payload.actorId ||
        Boolean(state.idToken) !== Boolean(action.payload.idToken)) {
        state.contextVersion += 1;
      }
      state.idToken = action.payload.idToken;
      state.companyId = action.payload.companyId;
      state.actorId = action.payload.actorId;
    },
    clearAuthTransport: (state) => {
      state.idToken = null;
      state.companyId = null;
      state.actorId = null;
      state.contextVersion += 1;
    },
  },
});

export const { setAuthTransport, clearAuthTransport } = authSlice.actions;
export default authSlice.reducer;
