import { Suspense, lazy } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import LoadingSpinner from './components/ui/LoadingSpinner';
import SafeProtectedRoute from './components/auth/SafeProtectedRoute';
import ErrorBoundary from './components/auth/ErrorBoundary';
import ScrollToTop from './components/ui/ScrollToTop';

// Lazy loaded pages
const HomePage = lazy(() => import('./pages/HomePage'));
const LaunchPage = lazy(() => import('./pages/LaunchPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const DienstleisterSearchPage = lazy(() => import('./pages/DienstleisterPage'));
const BetreuerProfilePage = lazy(() => import('./pages/BetreuerProfilePage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const ImpressumPage = lazy(() => import('./pages/ImpressumPage'));
const DatenschutzPage = lazy(() => import('./pages/DatenschutzPage'));
const AgbPage = lazy(() => import('./pages/AgbPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const OwnerDashboardPage = lazy(() => import('./pages/OwnerDashboardPage'));
const CaretakerDashboardPage = lazy(() => import('./pages/CaretakerDashboardPage'));
const DienstleisterProfilePage = lazy(() => import('./pages/DienstleisterProfilePage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const OwnerPublicProfilePage = lazy(() => import('./pages/OwnerPublicProfilePage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const PaymentSuccessPage = lazy(() => import('./pages/PaymentSuccessPage'));
const BlogListPage = lazy(() => import('./pages/BlogListPage'));
const BlogPostPage = lazy(() => import('./pages/BlogPostPage'));
const CleverreachRedirectPage = lazy(() => import('./pages/CleverreachRedirectPage'));
const HelpCenterPage = lazy(() => import('./pages/HelpCenterPage'));
const OwnerJobsPage = lazy(() => import('./pages/OwnerJobsPage'));
const ReleaseNotesListPage = lazy(() => import('./pages/ReleaseNotesListPage'));
const ReleaseNotePage = lazy(() => import('./pages/ReleaseNotePage'));
const MarketplacePage = lazy(() => import('./pages/MarketplacePage'));
const MarketplaceDetailPage = lazy(() => import('./pages/MarketplaceDetailPage'));
const CreateListingPage = lazy(() => import('./pages/CreateListingPage'));
const MyListingsPage = lazy(() => import('./pages/MyListingsPage'));
const EditListingPage = lazy(() => import('./pages/EditListingPage'));
const MarketplaceTermsPage = lazy(() => import('./pages/MarketplaceTermsPage'));
const FuerTierhalterPage = lazy(() => import('./pages/FuerTierhalterPage'));
const FuerBetreuungspersonenPage = lazy(() => import('./pages/FuerBetreuungspersonenPage'));
const FaqPage = lazy(() => import('./pages/FaqPage'));

// Debug components (only in development)



function App() {
  return (
    <ErrorBoundary>
      <Layout>
        <ScrollToTop />
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/launch" element={<LaunchPage />} />
            <Route path="/suche" element={<SearchPage />} />
            <Route path="/dienstleister" element={<DienstleisterSearchPage />} />
            <Route
              path="/betreuer/:id"
              element={
                <SafeProtectedRoute>
                  <BetreuerProfilePage />
                </SafeProtectedRoute>
              }
            />
            <Route
              path="/dienstleister/:id"
              element={
                <SafeProtectedRoute>
                  <DienstleisterProfilePage />
                </SafeProtectedRoute>
              }
            />
            <Route path="/registrieren" element={<RegisterPage />} />
            <Route path="/anmelden" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/impressum" element={<ImpressumPage />} />
            <Route path="/datenschutz" element={<DatenschutzPage />} />
            <Route path="/agb" element={<AgbPage />} />
            <Route path="/ueber-uns" element={<AboutPage />} />
            <Route path="/kontakt" element={<ContactPage />} />
            <Route path="/hilfe" element={<Navigate to="/faq" replace />} />
            <Route path="/fuer-tierhalter" element={<FuerTierhalterPage />} />
            <Route path="/fuer-betreuungspersonen" element={<FuerBetreuungspersonenPage />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/preise" element={<PricingPage />} />
            <Route path="/mitgliedschaften" element={<PricingPage />} />
            <Route path="/aktion" element={<Navigate to="/" replace />} />
            <Route path="/pricing" element={<Navigate to="/mitgliedschaften" replace />} />
            <Route path="/payment/success" element={<PaymentSuccessPage />} />
            <Route path="/blog" element={<BlogListPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            <Route path="/was-ist-neu" element={<ReleaseNotesListPage />} />
            <Route path="/was-ist-neu/:slug" element={<ReleaseNotePage />} />
            <Route path="/cleverreach" element={<CleverreachRedirectPage />} />
            <Route path="/newsletter/redirect" element={<CleverreachRedirectPage />} />
            <Route path="/newsletter/confirm" element={<CleverreachRedirectPage />} />
            <Route path="/newsletter/unsubscribe" element={<CleverreachRedirectPage />} />
            <Route path="/hilfe-center" element={<HelpCenterPage />} />
            <Route path="/marktplatz" element={<MarketplacePage />} />
            <Route
              path="/marktplatz/neu"
              element={
                <SafeProtectedRoute>
                  <CreateListingPage />
                </SafeProtectedRoute>
              }
            />
            <Route
              path="/marktplatz/meine"
              element={
                <SafeProtectedRoute>
                  <MyListingsPage />
                </SafeProtectedRoute>
              }
            />
            <Route
              path="/marktplatz/bearbeiten/:id"
              element={
                <SafeProtectedRoute>
                  <EditListingPage />
                </SafeProtectedRoute>
              }
            />
            <Route path="/marktplatz/nutzungsbedingungen" element={<MarketplaceTermsPage />} />
            <Route path="/marktplatz/:id" element={<MarketplaceDetailPage />} />

            {/* Test-Dashboard entfernt */}

            <Route
              path="/dashboard-owner"
              element={
                <SafeProtectedRoute requireOwner={true}>
                  <OwnerDashboardPage />
                </SafeProtectedRoute>
              }
            />
            <Route
              path="/dashboard-caretaker"
              element={
                <SafeProtectedRoute requireCaretaker={true}>
                  <CaretakerDashboardPage />
                </SafeProtectedRoute>
              }
            />
            <Route
              path="/nachrichten"
              element={
                <SafeProtectedRoute>
                  <MessagesPage />
                </SafeProtectedRoute>
              }
            />
            <Route
              path="/nachrichten/:conversationId"
              element={
                <SafeProtectedRoute>
                  <MessagesPage />
                </SafeProtectedRoute>
              }
            />
            <Route
              path="/owner/:userId"
              element={
                <SafeProtectedRoute>
                  <OwnerPublicProfilePage />
                </SafeProtectedRoute>
              }
            />
            <Route
              path="/gesuche"
              element={
                <SafeProtectedRoute>
                  <OwnerJobsPage />
                </SafeProtectedRoute>
              }
            />
            <Route path="/jobs" element={<Navigate to="/gesuche" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </Layout>
    </ErrorBoundary>
  );
}

export default App;