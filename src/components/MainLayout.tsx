import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { CheckSquare, Users, LogOut } from "lucide-react";
import { logout } from "../lib/firebase";
import { cn } from "../lib/utils";

export const MainLayout = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 md:flex-row text-gray-900 font-sans">
      <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200 z-50 md:relative md:w-[240px] md:border-t-0 md:border-r md:h-screen md:flex md:flex-col py-4 px-2 md:py-8 md:px-6 justify-between">
        <div className="flex md:flex-col justify-around md:justify-start gap-1 w-full h-16 md:h-auto items-center md:items-stretch">
          <div className="hidden md:flex items-center gap-2 mb-12">
            <h1 className="text-[20px] font-bold text-indigo-600 tracking-tight">Habits Social</h1>
          </div>
          
          <div className="flex md:flex-col gap-1 w-full justify-around md:justify-start">
            <NavLink
              to="/"
              className={({ isActive }) =>
                cn(
                  "flex flex-col md:flex-row items-center gap-3 p-3 rounded-[10px] text-[14px] font-medium transition-colors decoration-none",
                  isActive
                    ? "text-indigo-600 bg-indigo-50"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                )
              }
            >
              <CheckSquare className="w-6 h-6 md:w-5 md:h-5" />
              <span>Habits</span>
            </NavLink>
            <NavLink
              to="/social"
              className={({ isActive }) =>
                cn(
                  "flex flex-col md:flex-row items-center gap-3 p-3 rounded-[10px] text-[14px] font-medium transition-colors decoration-none",
                  isActive
                    ? "text-indigo-600 bg-indigo-50"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                )
              }
            >
              <Users className="w-6 h-6 md:w-5 md:h-5" />
              <span>Social</span>
            </NavLink>
          </div>
        </div>

        <div className="hidden md:flex flex-col gap-4 mt-auto">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 p-3 rounded-[10px] text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors w-full text-[14px] font-medium"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </nav>

      <main className="flex-1 pb-20 md:pb-0 overflow-y-auto w-full">
        <div className="w-full mx-auto p-4 md:p-[32px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
