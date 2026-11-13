import Agenda from './pages/Agenda';
import Clients from './pages/Clients';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import NewEntry from './pages/NewEntry';
import ActivityTypes from './pages/ActivityTypes';
import EmployeeLogin from './pages/EmployeeLogin';
import Reports from './pages/Reports';
import AuditHistory from './pages/AuditHistory';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Agenda": Agenda,
    "Clients": Clients,
    "Dashboard": Dashboard,
    "Employees": Employees,
    "NewEntry": NewEntry,
    "ActivityTypes": ActivityTypes,
    "entrar": EmployeeLogin,
    "Reports": Reports,
    "AuditHistory": AuditHistory,
}

export const pagesConfig = {
    mainPage: "Agenda",
    Pages: PAGES,
    Layout: __Layout,
};