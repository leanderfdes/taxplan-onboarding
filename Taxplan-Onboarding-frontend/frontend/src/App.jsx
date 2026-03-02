import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import Success from './pages/Success';
import DocumentUpload from './pages/DocumentUpload';
import FaceVerification from './pages/FaceVerification';
import IdentityVerification from './pages/IdentityVerification';
import TestList from './pages/assessment/TestList';
import Instructions from './pages/assessment/Instructions';
import TestEngine from './pages/assessment/TestEngine';
import AssessmentResult from './pages/assessment/AssessmentResult';
import OnboardingComplete from './pages/OnboardingComplete';
import Declaration from './pages/Declaration';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import ConsultantDetail from './pages/admin/ConsultantDetail';
import './index.css';

const GOOGLE_CLIENT_ID = '1051464119459-a5apk0uflgqp3le9avo2qttmmrqcsg52.apps.googleusercontent.com';

// Protected Route — requires authentication
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, user, stepFlags, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-gray-200 border-t-emerald-600"></div>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/" replace />;

  // Force declaration acceptance for any protected route EXCEPT the declaration page itself
  if (user && !stepFlags?.has_accepted_declaration && window.location.pathname !== '/declaration') {
    return <Navigate to="/declaration" replace />;
  }

  return children;
};

// Public Route — redirect if already logged in
const PublicRoute = ({ children }) => {
  const { isAuthenticated, user, loading, stepFlags } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-gray-200 border-t-emerald-600"></div>
      </div>
    );
  }
  if (isAuthenticated) {
    if (user && !stepFlags?.has_accepted_declaration) return <Navigate to="/declaration" replace />;
    if (user && !user.is_onboarded) return <Navigate to="/onboarding" replace />;
    return <Navigate to="/success" replace />;
  }
  return children;
};


const StepGuard = ({ step, children }) => {
  const { user, stepFlags, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-gray-200 border-t-emerald-600"></div>
      </div>
    );
  }

  // Step requirements (each requires all previous to be true)
  // Step 1: Profile (onboarding) — no prereqs, just authenticated
  // Step 2: Identity — requires is_onboarded
  // Step 3: Face — requires is_onboarded + has_identity_doc
  // Step 4: Assessment — requires is_onboarded + is_verified
  // Step 5: Documents — requires is_onboarded + has_passed_assessment

  const onboarded = user?.is_onboarded;
  const hasAcceptedDeclaration = stepFlags?.has_accepted_declaration;
  const hasIdentity = stepFlags?.has_identity_doc;
  const verified = user?.is_verified;
  const passedAssessment = stepFlags?.has_passed_assessment;

  let allowed = false;
  switch (step) {
    case 'onboarding':
      allowed = !onboarded;
      break;
    case 'identity':
      allowed = onboarded && !verified;
      break;
    case 'face':
      allowed = onboarded && hasIdentity && !verified;
      break;
    case 'assessment':
      allowed = onboarded && verified;
      break;
    case 'documents':
      allowed = onboarded && passedAssessment;
      break;
    case 'dashboard':
      allowed = onboarded;
      break;
    default:
      allowed = true;
  }

  if (!allowed) {
    if (!hasAcceptedDeclaration) return <Navigate to="/declaration" replace />;
    if (!onboarded) return <Navigate to="/onboarding" replace />;
    return <Navigate to="/success" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/declaration" element={
        <ProtectedRoute><Declaration /></ProtectedRoute>
      } />
      <Route path="/onboarding" element={
        <ProtectedRoute><StepGuard step="onboarding"><Onboarding /></StepGuard></ProtectedRoute>
      } />
      <Route path="/success" element={
        <ProtectedRoute><StepGuard step="dashboard"><Success /></StepGuard></ProtectedRoute>
      } />
      <Route path="/onboarding/identity" element={
        <ProtectedRoute><StepGuard step="identity"><IdentityVerification /></StepGuard></ProtectedRoute>
      } />
      <Route path="/onboarding/face-verification" element={
        <ProtectedRoute><StepGuard step="face"><FaceVerification /></StepGuard></ProtectedRoute>
      } />
      <Route path="/assessment/select" element={
        <ProtectedRoute><StepGuard step="assessment"><TestList /></StepGuard></ProtectedRoute>
      } />
      <Route path="/assessment/instructions" element={
        <ProtectedRoute><StepGuard step="assessment"><Instructions /></StepGuard></ProtectedRoute>
      } />
      <Route path="/assessment/test" element={
        <ProtectedRoute><StepGuard step="assessment"><TestEngine /></StepGuard></ProtectedRoute>
      } />
      <Route path="/assessment/result" element={
        <ProtectedRoute><AssessmentResult /></ProtectedRoute>
      } />
      <Route path="/onboarding/documentation" element={
        <ProtectedRoute><StepGuard step="documents"><DocumentUpload /></StepGuard></ProtectedRoute>
      } />
      <Route path="/onboarding/complete" element={
        <ProtectedRoute><OnboardingComplete /></ProtectedRoute>
      } />

      {/* Admin Panel Routes — standalone, no auth guards */}
      <Route path="/admin" element={<AdminLogin />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/admin/consultant/:id" element={<ConsultantDetail />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Router>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </Router>
    </GoogleOAuthProvider>
  );
}

export default App;
