import { combineReducers } from "@reduxjs/toolkit";

import authReducer from "@/lib/store/auth/auth-slice";
import layoutTabsReducer from "@/lib/store/layout/tabs-slice";

export const rootReducer = combineReducers({
  auth: authReducer,
  layoutTabs: layoutTabsReducer,
});
