import { combineReducers } from "@reduxjs/toolkit";

import authReducer from "@/lib/store/auth/auth-slice";

export const rootReducer = combineReducers({
  auth: authReducer,
});
