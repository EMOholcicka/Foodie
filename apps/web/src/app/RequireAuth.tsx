import { Navigate, useLocation } from "react-router-dom";

import { loadStoredAccessToken } from "../shared/api/auth";

export function RequireAuth(props: { children: React.ReactElement }) {
  const location = useLocation();
  const token = loadStoredAccessToken();

  if (!token) {
    const next = location.pathname + location.search;
    const sp = new URLSearchParams();
    sp.set("reason", "required");
    sp.set("next", next);
    return <Navigate to={`/auth?${sp.toString()}`} replace />;
  }

  return props.children;
}
