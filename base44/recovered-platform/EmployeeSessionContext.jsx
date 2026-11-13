import React, { createContext, useContext, useState, useEffect } from "react";

const EmployeeSessionContext = createContext(null);

export function EmployeeSessionProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const raw = sessionStorage.getItem("employeeSession");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const logout = () => {
    sessionStorage.removeItem("employeeSession");
    setSession(null);
  };

  return (
    <EmployeeSessionContext.Provider value={{ session, setSession, logout }}>
      {children}
    </EmployeeSessionContext.Provider>
  );
}

export function useEmployeeSession() {
  return useContext(EmployeeSessionContext);
}