import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";


import Home from "./pages/Home";


import Login from "./pages/Password/Login";
import Register from "./pages/Password/Register";
import resetpassword from "./pages/Password/resetpassword";
import reset_password from "./pages/Password/reset-password";


import Contact from "./pages/Contacts/Contact";



import Dashboard from "./pages/Dashboard";
/*
import DashboardPagepayment from './pages/Payments/dashboardpagepayment';       <Route path="/dashboardpagepayment" component={() => <ProtectedRoute component={DashboardPagepayment} />} /> 
*/

import CreateOrder from "./pages/Orders/CreateOrder";
import OrderDetails from "./pages/Orders/OrderDetails";
//import AddServeiv from "./pages/Orders/AddService";   <Route path="/AddService" component={() => <ProtectedRoute component={AddServeiv} />} />


/*
import CreatePaymentIntentPage from './pages/Payments/CreatePaymentIntentPage';  {/* Route Payments /}
      <Route path="/create-intent" component={() => <ProtectedRoute component={CreatePaymentIntentPage} />} />
      <Route path="/confirm" component={() => <ProtectedRoute component={ConfirmPaymentPage} />} />
      <Route path="/refund" component={() => <ProtectedRoute component={RefundPaymentPage} />} />
      <Route path="/status" component={() =><ProtectedRoute component={PaymentStatusPage} />} />
      <Route path="/invoices" component={() => <ProtectedRoute component={InvoicesListPage} />} />
      <Route path="/generate-pdf" component={() => <ProtectedRoute component={GenerateInvoicePDFPage} />} />

import ConfirmPaymentPage from './pages/Payments/ConfirmPaymentPage';
import RefundPaymentPage from './pages/Payments/RefundPaymentPage';
import PaymentStatusPage from './pages/Payments/PaymentStatusPage';
import InvoicesListPage from './pages/Payments/InvoicesListPage';
import GenerateInvoicePDFPage from './pages/Payments/GenerateInvoicePDFPage';
*/

import NotFound from "./pages/NotFound";
//import ServiceForm from "./components/ServiceForm";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  
  const { user, isLoading } = useAuth();


  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">جاري التحميل...</p>
      </div>
    );
  }

  if (!user) {
    window.location.href = '/login';
    return null;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      
      {/* Route Login */}
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/reset-password" component={reset_password} />
      <Route path="/resetpassword" component={() => <ProtectedRoute component={resetpassword}  />} />
      
      {/* Route Contact */}
      <Route path="/contact" component={Contact} />

      
      {/* Route Dashboared */}
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      
      {/* Route Orders */}
      <Route path="/OrderDetails" component={() => <ProtectedRoute component={OrderDetails} />} />
      <Route path="/create-order" component={() => <ProtectedRoute component={CreateOrder} />} />
      	   
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
