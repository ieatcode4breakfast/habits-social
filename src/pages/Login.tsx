import { loginWithGoogle } from "../lib/firebase";
import { useAuth } from "../components/AuthProvider";
import { Navigate } from "react-router-dom";
import { LogIn } from "lucide-react";

export const Login = () => {
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-sm w-full space-y-8 text-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Habits Social</h1>
          <p className="text-slate-500 mt-2">Track habits, share with friends.</p>
        </div>
        
        <button
          onClick={() => loginWithGoogle().catch(console.error)}
          className="flex items-center justify-center w-full gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          <LogIn className="w-5 h-5" />
          Continue with Google
        </button>
      </div>
    </div>
  );
};
