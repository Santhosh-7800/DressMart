import { Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { MainLayout } from '@/layouts/MainLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { AccountLayout } from '@/layouts/AccountLayout';
import { AdminLayout } from '@/layouts/AdminLayout';
import { StaffLayout } from '@/layouts/StaffLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { RequireAdmin } from './RequireAdmin';
import { RequireStaff } from './RequireStaff';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { DEEP_LINK_EVENT } from '@/lib/deepLinks';
import { useAuth } from '@/contexts/AuthContext';
import { getPostLoginRedirect } from '@/lib/roles';

const HomePage = lazyWithRetry(() => import('@/pages/home/HomePage').then((m) => ({ default: m.HomePage })));
const SearchResultsPage = lazyWithRetry(() => import('@/pages/home/SearchResultsPage').then((m) => ({ default: m.SearchResultsPage })));
const VisualSearchResultsPage = lazyWithRetry(() =>
  import('@/pages/home/VisualSearchResultsPage').then((m) => ({ default: m.VisualSearchResultsPage })),
);
const DealsPage = lazyWithRetry(() => import('@/pages/home/DealsPage').then((m) => ({ default: m.DealsPage })));
const FlashSalesPage = lazyWithRetry(() => import('@/pages/home/FlashSalesPage').then((m) => ({ default: m.FlashSalesPage })));
const NewArrivalsPage = lazyWithRetry(() => import('@/pages/home/NewArrivalsPage').then((m) => ({ default: m.NewArrivalsPage })));
const BestSellersPage = lazyWithRetry(() => import('@/pages/home/BestSellersPage').then((m) => ({ default: m.BestSellersPage })));

const MenHomePage = lazyWithRetry(() => import('@/pages/men/MenHomePage').then((m) => ({ default: m.MenHomePage })));
const MenCategoryPage = lazyWithRetry(() => import('@/pages/men/MenCategoryPage').then((m) => ({ default: m.MenCategoryPage })));
const KidsHomePage = lazyWithRetry(() => import('@/pages/kids/KidsHomePage').then((m) => ({ default: m.KidsHomePage })));
const KidsCategoryPage = lazyWithRetry(() => import('@/pages/kids/KidsCategoryPage').then((m) => ({ default: m.KidsCategoryPage })));
const CategoriesLandingPage = lazyWithRetry(() => import('@/pages/category/CategoriesLandingPage').then((m) => ({ default: m.CategoriesLandingPage })));

const ProductDetailsPage = lazyWithRetry(() => import('@/pages/product/ProductDetailsPage').then((m) => ({ default: m.ProductDetailsPage })));
const WishlistPage = lazyWithRetry(() => import('@/pages/wishlist/WishlistPage').then((m) => ({ default: m.WishlistPage })));
const CartPage = lazyWithRetry(() => import('@/pages/cart/CartPage').then((m) => ({ default: m.CartPage })));

const CheckoutPage = lazyWithRetry(() => import('@/pages/checkout/CheckoutPage').then((m) => ({ default: m.CheckoutPage })));
const PaymentPage = lazyWithRetry(() => import('@/pages/checkout/PaymentPage').then((m) => ({ default: m.PaymentPage })));
const OrderSuccessPage = lazyWithRetry(() => import('@/pages/checkout/OrderSuccessPage').then((m) => ({ default: m.OrderSuccessPage })));

const OrdersPage = lazyWithRetry(() => import('@/pages/orders/OrdersPage').then((m) => ({ default: m.OrdersPage })));
const OrderDetailsPage = lazyWithRetry(() => import('@/pages/orders/OrderDetailsPage').then((m) => ({ default: m.OrderDetailsPage })));
const TrackOrderPage = lazyWithRetry(() => import('@/pages/orders/TrackOrderPage').then((m) => ({ default: m.TrackOrderPage })));

const LoginPage = lazyWithRetry(() => import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const SignupPage = lazyWithRetry(() => import('@/pages/auth/SignupPage').then((m) => ({ default: m.SignupPage })));
const ForgotPasswordPage = lazyWithRetry(() => import('@/pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const OtpVerificationPage = lazyWithRetry(() => import('@/pages/auth/OtpVerificationPage').then((m) => ({ default: m.OtpVerificationPage })));
const ResetPasswordPage = lazyWithRetry(() => import('@/pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));

const ProfilePage = lazyWithRetry(() => import('@/pages/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const AddressesPage = lazyWithRetry(() => import('@/pages/profile/AddressesPage').then((m) => ({ default: m.AddressesPage })));
const NotificationsPage = lazyWithRetry(() => import('@/pages/profile/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const CouponsPage = lazyWithRetry(() => import('@/pages/profile/CouponsPage').then((m) => ({ default: m.CouponsPage })));
const PaymentsPage = lazyWithRetry(() => import('@/pages/profile/PaymentsPage').then((m) => ({ default: m.PaymentsPage })));
const SettingsPage = lazyWithRetry(() => import('@/pages/profile/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const SearchHistoryPage = lazyWithRetry(() => import('@/pages/profile/SearchHistoryPage').then((m) => ({ default: m.SearchHistoryPage })));

const HelpCenterPage = lazyWithRetry(() => import('@/pages/static/HelpCenterPage').then((m) => ({ default: m.HelpCenterPage })));
const SupportListPage = lazyWithRetry(() => import('@/pages/support/SupportListPage').then((m) => ({ default: m.SupportListPage })));
const NewSupportTicketPage = lazyWithRetry(() => import('@/pages/support/NewSupportTicketPage').then((m) => ({ default: m.NewSupportTicketPage })));
const SupportDetailPage = lazyWithRetry(() => import('@/pages/support/SupportDetailPage').then((m) => ({ default: m.SupportDetailPage })));
const PrivacyPolicyPage = lazyWithRetry(() => import('@/pages/static/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage })));
const TermsPage = lazyWithRetry(() => import('@/pages/static/TermsPage').then((m) => ({ default: m.TermsPage })));
const NotFoundPage = lazyWithRetry(() => import('@/pages/errors/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
const UnauthorizedPage = lazyWithRetry(() => import('@/pages/errors/UnauthorizedPage').then((m) => ({ default: m.UnauthorizedPage })));

// Admin pages
const AdminDashboardPage = lazyWithRetry(() => import('@/pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })));
const AdminProductsPage = lazyWithRetry(() => import('@/pages/admin/AdminProductsPage').then((m) => ({ default: m.AdminProductsPage })));
const AdminProductFormPage = lazyWithRetry(() => import('@/pages/admin/AdminProductFormPage').then((m) => ({ default: m.AdminProductFormPage })));
const AdminInventoryPage = lazyWithRetry(() => import('@/pages/admin/AdminInventoryPage').then((m) => ({ default: m.AdminInventoryPage })));
const AdminOrdersPage = lazyWithRetry(() => import('@/pages/admin/AdminOrdersPage').then((m) => ({ default: m.AdminOrdersPage })));
const AdminReturnsPage = lazyWithRetry(() => import('@/pages/admin/AdminReturnsPage').then((m) => ({ default: m.AdminReturnsPage })));
const AdminExchangesPage = lazyWithRetry(() => import('@/pages/admin/AdminExchangesPage').then((m) => ({ default: m.AdminExchangesPage })));
const AdminSettingsPage = lazyWithRetry(() => import('@/pages/admin/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage })));
const AdminCustomersPage = lazyWithRetry(() => import('@/pages/admin/AdminCustomersPage').then((m) => ({ default: m.AdminCustomersPage })));
const AdminAllProductsPage = lazyWithRetry(() => import('@/pages/admin/AdminAllProductsPage').then((m) => ({ default: m.AdminAllProductsPage })));
const AdminAnalyticsPage = lazyWithRetry(() => import('@/pages/admin/AdminAnalyticsPage').then((m) => ({ default: m.AdminAnalyticsPage })));
const AdminReportsPage = lazyWithRetry(() => import('@/pages/admin/AdminReportsPage').then((m) => ({ default: m.AdminReportsPage })));
const AdminBusinessReportsPage = lazyWithRetry(() =>
  import('@/pages/admin/AdminBusinessReportsPage').then((m) => ({ default: m.AdminBusinessReportsPage })),
);
const AdminCouponsPage = lazyWithRetry(() => import('@/pages/admin/AdminCouponsPage').then((m) => ({ default: m.AdminCouponsPage })));
const AdminPlatformSettingsPage = lazyWithRetry(() => import('@/pages/admin/AdminPlatformSettingsPage').then((m) => ({ default: m.AdminPlatformSettingsPage })));
const AdminLoginPage = lazyWithRetry(() => import('@/pages/admin/AdminLoginPage').then((m) => ({ default: m.AdminLoginPage })));
const AdminSetupPage = lazyWithRetry(() => import('@/pages/admin/AdminSetupPage').then((m) => ({ default: m.AdminSetupPage })));
const AdminCategoriesPage = lazyWithRetry(() => import('@/pages/admin/AdminCategoriesPage').then((m) => ({ default: m.AdminCategoriesPage })));
const AdminBrandsPage = lazyWithRetry(() => import('@/pages/admin/AdminBrandsPage').then((m) => ({ default: m.AdminBrandsPage })));
const AdminBannersPage = lazyWithRetry(() => import('@/pages/admin/AdminBannersPage').then((m) => ({ default: m.AdminBannersPage })));
const AdminReviewsPage = lazyWithRetry(() => import('@/pages/admin/AdminReviewsPage').then((m) => ({ default: m.AdminReviewsPage })));
const AdminNotificationsPage = lazyWithRetry(() => import('@/pages/admin/AdminNotificationsPage').then((m) => ({ default: m.AdminNotificationsPage })));
const AdminStaffPage = lazyWithRetry(() => import('@/pages/admin/AdminStaffPage').then((m) => ({ default: m.AdminStaffPage })));
const AdminFaqPage = lazyWithRetry(() => import('@/pages/admin/AdminFaqPage').then((m) => ({ default: m.AdminFaqPage })));
const AdminSupportPage = lazyWithRetry(() => import('@/pages/admin/AdminSupportPage').then((m) => ({ default: m.AdminSupportPage })));
const AdminSupportDetailPage = lazyWithRetry(() => import('@/pages/admin/AdminSupportDetailPage').then((m) => ({ default: m.AdminSupportDetailPage })));

// Staff pages
const StaffLoginPage = lazyWithRetry(() => import('@/pages/staff/StaffLoginPage').then((m) => ({ default: m.StaffLoginPage })));
const StaffDashboardPage = lazyWithRetry(() => import('@/pages/staff/StaffDashboardPage').then((m) => ({ default: m.StaffDashboardPage })));
const StaffActivityPage = lazyWithRetry(() => import('@/pages/staff/StaffActivityPage').then((m) => ({ default: m.StaffActivityPage })));
const StaffProfilePage = lazyWithRetry(() => import('@/pages/staff/StaffProfilePage').then((m) => ({ default: m.StaffProfilePage })));

function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="animate-spin text-primary-300" size={32} />
    </div>
  );
}

/** Gates "/" itself: signed-out visitors are sent to /login instead of browsing Home. An
 *  authenticated admin/staff user is sent straight to their own dashboard instead of the
 *  buyer Home — this matters most on mobile, where the app relaunching (backgrounded and killed
 *  by the OS, or just reopened) lands back on "/" far more often than a desktop browser tab ever
 *  does; without this, that non-buyer account would see the buyer storefront every time, even
 *  though LoginPage's own post-submit redirect (see lib/roles.ts's getPostLoginRedirect, the same
 *  function this mirrors) already got it right immediately after actually signing in. A plain
 *  buyer still just sees Home as normal. Waits out AuthContext's initial isLoading so a
 *  refreshing, already-logged-in user doesn't flash the login page before their session resolves. */
function RootGate() {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return <RouteFallback />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  const roleRedirect = getPostLoginRedirect(user?.role, '/');
  if (roleRedirect !== '/') return <Navigate to={roleRedirect} replace />;
  return <HomePage />;
}

/** Bridges native deep-link events (dispatched by initCapacitorNative, outside the React tree)
 *  into a real client-side navigation. No-op on the web — the event is only ever dispatched from
 *  the native appUrlOpen listener, which itself only runs on Capacitor's native platform. */
function useDeepLinkNavigation() {
  const navigate = useNavigate();
  useEffect(() => {
    const handler = (e: Event) => {
      const path = (e as CustomEvent<string>).detail;
      if (path) navigate(path);
    };
    window.addEventListener(DEEP_LINK_EVENT, handler);
    return () => window.removeEventListener(DEEP_LINK_EVENT, handler);
  }, [navigate]);
}

export function AppRoutes() {
  useDeepLinkNavigation();

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<RootGate />} />
          <Route path="/search" element={<SearchResultsPage />} />
          <Route path="/visual-search" element={<VisualSearchResultsPage />} />
          <Route path="/deals" element={<DealsPage />} />
          <Route path="/flash-sales" element={<FlashSalesPage />} />
          <Route path="/new-arrivals" element={<NewArrivalsPage />} />
          <Route path="/best-sellers" element={<BestSellersPage />} />

          <Route path="/categories" element={<CategoriesLandingPage />} />
          <Route path="/men" element={<MenHomePage />} />
          <Route path="/men/:categorySlug" element={<MenCategoryPage />} />
          <Route path="/kids" element={<KidsHomePage />} />
          <Route path="/kids/:categorySlug" element={<KidsCategoryPage />} />

          <Route path="/product/:slug" element={<ProductDetailsPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/cart" element={<CartPage />} />

          <Route path="/help-center" element={<HelpCenterPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/checkout/payment" element={<PaymentPage />} />
            <Route path="/order-success/:orderId" element={<OrderSuccessPage />} />
            <Route path="/track-order" element={<TrackOrderPage />} />

            {/* Standalone — not nested under AccountLayout. Orders is its own top-level
                BottomNavBar destination (see BottomNavBar.tsx), so it renders as a plain full-width
                page like Wishlist/Cart rather than opening inside the "My Account" sidebar shell. */}
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/:orderId" element={<OrderDetailsPage />} />

            {/* Support (Phase 16) — same "standalone, not under AccountLayout" reasoning as Orders
                above: a request's conversation view is its own full-width page, not a sidebar tab. */}
            <Route path="/support" element={<SupportListPage />} />
            <Route path="/support/new" element={<NewSupportTicketPage />} />
            <Route path="/support/:ticketId" element={<SupportDetailPage />} />

            <Route element={<AccountLayout />}>
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/addresses" element={<AddressesPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/coupons" element={<CouponsPage />} />
              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/search-history" element={<SearchHistoryPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Route>

        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/verify-otp" element={<OtpVerificationPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/setup" element={<AdminSetupPage />} />
          <Route path="/staff/login" element={<StaffLoginPage />} />
        </Route>

        {/* Admin Dashboard Routes */}
        <Route element={<RequireAdmin />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/products" element={<AdminProductsPage />} />
            <Route path="/admin/products/new" element={<AdminProductFormPage />} />
            <Route path="/admin/products/:id/edit" element={<AdminProductFormPage />} />
            <Route path="/admin/inventory" element={<AdminInventoryPage />} />
            <Route path="/admin/orders" element={<AdminOrdersPage />} />
            <Route path="/admin/returns" element={<AdminReturnsPage />} />
            <Route path="/admin/exchanges" element={<AdminExchangesPage />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
            <Route path="/admin/reviews" element={<AdminReviewsPage />} />
            <Route path="/admin/notifications" element={<AdminNotificationsPage />} />
            <Route path="/admin/customers" element={<AdminCustomersPage />} />
            <Route path="/admin/staff" element={<AdminStaffPage />} />
            <Route path="/admin/support" element={<AdminSupportPage />} />
            <Route path="/admin/support/:ticketId" element={<AdminSupportDetailPage />} />
            <Route path="/admin/faq" element={<AdminFaqPage />} />
            <Route path="/admin/all-products" element={<AdminAllProductsPage />} />
            <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
            <Route path="/admin/reports" element={<AdminReportsPage />} />
            <Route path="/admin/business-reports" element={<AdminBusinessReportsPage />} />
            <Route path="/admin/coupons" element={<AdminCouponsPage />} />
            <Route path="/admin/categories" element={<AdminCategoriesPage />} />
            <Route path="/admin/brands" element={<AdminBrandsPage />} />
            <Route path="/admin/banners" element={<AdminBannersPage />} />
            <Route path="/admin/platform-settings" element={<AdminPlatformSettingsPage />} />
          </Route>
        </Route>

        {/* Staff Dashboard Routes — the Staff role is product-management-only (see StaffLayout's
            fixed nav): Products/Inventory reuse the same admin page components (see
            AdminProductFormPage/productService for how seller_id resolution and
            created_by/staff_id attribution differ for a staff actor), while Activity and Profile
            are dedicated staff-only pages. No Orders/Returns/Revenue/Admin-Management access. */}
        <Route element={<RequireStaff />}>
          <Route element={<StaffLayout />}>
            <Route path="/staff/dashboard" element={<StaffDashboardPage />} />
            <Route path="/staff/products" element={<AdminProductsPage />} />
            <Route path="/staff/products/new" element={<AdminProductFormPage />} />
            <Route path="/staff/products/:id/edit" element={<AdminProductFormPage />} />
            <Route path="/staff/inventory" element={<AdminInventoryPage />} />
            <Route path="/staff/activity" element={<StaffActivityPage />} />
            <Route path="/staff/settings" element={<StaffProfilePage />} />
          </Route>
        </Route>

        {/* Bare-path convenience aliases. Each target route's own guard (RequireAdmin/RequireStaff)
            handles the actual auth/role redirect from there — these are pure path aliases, not a
            parallel auth check. /seller and /head-seller are kept as legacy aliases in case any
            old bookmarks/links still use them. */}
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/seller" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/staff" element={<Navigate to="/staff/dashboard" replace />} />
        <Route path="/head-seller" element={<Navigate to="/admin/dashboard" replace />} />

        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
