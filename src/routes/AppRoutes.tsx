import { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { MainLayout } from '@/layouts/MainLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { AccountLayout } from '@/layouts/AccountLayout';
import { AdminLayout } from '@/layouts/AdminLayout';
import { StaffLayout } from '@/layouts/StaffLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { RequireRole } from './RequireRole';
import { RequireStaffOnly } from './RequireStaffOnly';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { BACKEND_ROLES } from '@/lib/roles';

const HomePage = lazyWithRetry(() => import('@/pages/home/HomePage').then((m) => ({ default: m.HomePage })));
const SearchResultsPage = lazyWithRetry(() => import('@/pages/home/SearchResultsPage').then((m) => ({ default: m.SearchResultsPage })));
const DealsPage = lazyWithRetry(() => import('@/pages/home/DealsPage').then((m) => ({ default: m.DealsPage })));
const FlashSalesPage = lazyWithRetry(() => import('@/pages/home/FlashSalesPage').then((m) => ({ default: m.FlashSalesPage })));
const NewArrivalsPage = lazyWithRetry(() => import('@/pages/home/NewArrivalsPage').then((m) => ({ default: m.NewArrivalsPage })));
const BestSellersPage = lazyWithRetry(() => import('@/pages/home/BestSellersPage').then((m) => ({ default: m.BestSellersPage })));

const MenHomePage = lazyWithRetry(() => import('@/pages/men/MenHomePage').then((m) => ({ default: m.MenHomePage })));
const MenCategoryPage = lazyWithRetry(() => import('@/pages/men/MenCategoryPage').then((m) => ({ default: m.MenCategoryPage })));
const KidsHomePage = lazyWithRetry(() => import('@/pages/kids/KidsHomePage').then((m) => ({ default: m.KidsHomePage })));
const KidsCategoryPage = lazyWithRetry(() => import('@/pages/kids/KidsCategoryPage').then((m) => ({ default: m.KidsCategoryPage })));

const ProductDetailsPage = lazyWithRetry(() => import('@/pages/product/ProductDetailsPage').then((m) => ({ default: m.ProductDetailsPage })));
const TryOnPage = lazyWithRetry(() => import('@/pages/tryon/TryOnPage').then((m) => ({ default: m.TryOnPage })));
const StyleQuizPage = lazyWithRetry(() => import('@/pages/quiz/StyleQuizPage').then((m) => ({ default: m.StyleQuizPage })));
const WishlistPage = lazyWithRetry(() => import('@/pages/wishlist/WishlistPage').then((m) => ({ default: m.WishlistPage })));
const WishlistCollectionsPage = lazyWithRetry(() => import('@/pages/wishlist/WishlistCollectionsPage').then((m) => ({ default: m.WishlistCollectionsPage })));
const SharedWishlistPage = lazyWithRetry(() => import('@/pages/wishlist/SharedWishlistPage').then((m) => ({ default: m.SharedWishlistPage })));
const CartPage = lazyWithRetry(() => import('@/pages/cart/CartPage').then((m) => ({ default: m.CartPage })));
const ComparePage = lazyWithRetry(() => import('@/pages/compare/ComparePage').then((m) => ({ default: m.ComparePage })));

const CheckoutPage = lazyWithRetry(() => import('@/pages/checkout/CheckoutPage').then((m) => ({ default: m.CheckoutPage })));
const PaymentPage = lazyWithRetry(() => import('@/pages/checkout/PaymentPage').then((m) => ({ default: m.PaymentPage })));
const OrderSuccessPage = lazyWithRetry(() => import('@/pages/checkout/OrderSuccessPage').then((m) => ({ default: m.OrderSuccessPage })));

const OrdersPage = lazyWithRetry(() => import('@/pages/orders/OrdersPage').then((m) => ({ default: m.OrdersPage })));
const OrderDetailsPage = lazyWithRetry(() => import('@/pages/orders/OrderDetailsPage').then((m) => ({ default: m.OrderDetailsPage })));
const TrackOrderPage = lazyWithRetry(() => import('@/pages/orders/TrackOrderPage').then((m) => ({ default: m.TrackOrderPage })));
const RewardsPage = lazyWithRetry(() => import('@/pages/rewards/RewardsPage').then((m) => ({ default: m.RewardsPage })));
const ReferralsPage = lazyWithRetry(() => import('@/pages/referrals/ReferralsPage').then((m) => ({ default: m.ReferralsPage })));

const LoginPage = lazyWithRetry(() => import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const SignupPage = lazyWithRetry(() => import('@/pages/auth/SignupPage').then((m) => ({ default: m.SignupPage })));
const ForgotPasswordPage = lazyWithRetry(() => import('@/pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const OtpVerificationPage = lazyWithRetry(() => import('@/pages/auth/OtpVerificationPage').then((m) => ({ default: m.OtpVerificationPage })));
const ResetPasswordPage = lazyWithRetry(() => import('@/pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));

const ProfilePage = lazyWithRetry(() => import('@/pages/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const AddressesPage = lazyWithRetry(() => import('@/pages/profile/AddressesPage').then((m) => ({ default: m.AddressesPage })));
const SavedPaymentsPage = lazyWithRetry(() => import('@/pages/profile/SavedPaymentsPage').then((m) => ({ default: m.SavedPaymentsPage })));
const NotificationsPage = lazyWithRetry(() => import('@/pages/profile/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const CouponsPage = lazyWithRetry(() => import('@/pages/profile/CouponsPage').then((m) => ({ default: m.CouponsPage })));
const SettingsPage = lazyWithRetry(() => import('@/pages/profile/SettingsPage').then((m) => ({ default: m.SettingsPage })));

const HelpCenterPage = lazyWithRetry(() => import('@/pages/static/HelpCenterPage').then((m) => ({ default: m.HelpCenterPage })));
const PrivacyPolicyPage = lazyWithRetry(() => import('@/pages/static/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage })));
const TermsPage = lazyWithRetry(() => import('@/pages/static/TermsPage').then((m) => ({ default: m.TermsPage })));
const NotFoundPage = lazyWithRetry(() => import('@/pages/errors/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

const AdminDashboardPage = lazyWithRetry(() => import('@/pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })));
const AdminProductsPage = lazyWithRetry(() => import('@/pages/admin/AdminProductsPage').then((m) => ({ default: m.AdminProductsPage })));
const AdminProductFormPage = lazyWithRetry(() => import('@/pages/admin/AdminProductFormPage').then((m) => ({ default: m.AdminProductFormPage })));
const AdminCategoriesPage = lazyWithRetry(() => import('@/pages/admin/AdminCategoriesPage').then((m) => ({ default: m.AdminCategoriesPage })));
const AdminInventoryPage = lazyWithRetry(() => import('@/pages/admin/AdminInventoryPage').then((m) => ({ default: m.AdminInventoryPage })));
const AdminOrdersPage = lazyWithRetry(() => import('@/pages/admin/AdminOrdersPage').then((m) => ({ default: m.AdminOrdersPage })));
const AdminCustomersPage = lazyWithRetry(() => import('@/pages/admin/AdminCustomersPage').then((m) => ({ default: m.AdminCustomersPage })));
const AdminCustomerDetailPage = lazyWithRetry(() => import('@/pages/admin/AdminCustomerDetailPage').then((m) => ({ default: m.AdminCustomerDetailPage })));
const AdminReturnsPage = lazyWithRetry(() => import('@/pages/admin/AdminReturnsPage').then((m) => ({ default: m.AdminReturnsPage })));
const AdminOffersPage = lazyWithRetry(() => import('@/pages/admin/AdminOffersPage').then((m) => ({ default: m.AdminOffersPage })));
const AdminCouponsPage = lazyWithRetry(() => import('@/pages/admin/AdminCouponsPage').then((m) => ({ default: m.AdminCouponsPage })));
const AdminAnalyticsPage = lazyWithRetry(() => import('@/pages/admin/AdminAnalyticsPage').then((m) => ({ default: m.AdminAnalyticsPage })));
const AdminReportsPage = lazyWithRetry(() => import('@/pages/admin/AdminReportsPage').then((m) => ({ default: m.AdminReportsPage })));
const AdminStaffPage = lazyWithRetry(() => import('@/pages/admin/AdminStaffPage').then((m) => ({ default: m.AdminStaffPage })));
const AdminStaffProductsPage = lazyWithRetry(() => import('@/pages/admin/AdminStaffProductsPage').then((m) => ({ default: m.AdminStaffProductsPage })));
const AdminSettingsPage = lazyWithRetry(() => import('@/pages/admin/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage })));
const AdminLoginPage = lazyWithRetry(() => import('@/pages/admin/AdminLoginPage').then((m) => ({ default: m.AdminLoginPage })));

const StaffLoginPage = lazyWithRetry(() => import('@/pages/staff/StaffLoginPage').then((m) => ({ default: m.StaffLoginPage })));
const StaffDashboardPage = lazyWithRetry(() => import('@/pages/staff/StaffDashboardPage').then((m) => ({ default: m.StaffDashboardPage })));
const StaffProductsPage = lazyWithRetry(() => import('@/pages/staff/StaffProductsPage').then((m) => ({ default: m.StaffProductsPage })));
const StaffProductFormPage = lazyWithRetry(() => import('@/pages/staff/StaffProductFormPage').then((m) => ({ default: m.StaffProductFormPage })));
const StaffInventoryPage = lazyWithRetry(() => import('@/pages/staff/StaffInventoryPage').then((m) => ({ default: m.StaffInventoryPage })));
const StaffProfilePage = lazyWithRetry(() => import('@/pages/staff/StaffProfilePage').then((m) => ({ default: m.StaffProfilePage })));
const StaffSettingsPage = lazyWithRetry(() => import('@/pages/staff/StaffSettingsPage').then((m) => ({ default: m.StaffSettingsPage })));

function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="animate-spin text-primary-300" size={32} />
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchResultsPage />} />
          <Route path="/deals" element={<DealsPage />} />
          <Route path="/flash-sales" element={<FlashSalesPage />} />
          <Route path="/new-arrivals" element={<NewArrivalsPage />} />
          <Route path="/best-sellers" element={<BestSellersPage />} />

          <Route path="/men" element={<MenHomePage />} />
          <Route path="/men/:categorySlug" element={<MenCategoryPage />} />
          <Route path="/kids" element={<KidsHomePage />} />
          <Route path="/kids/:categorySlug" element={<KidsCategoryPage />} />

          <Route path="/product/:slug" element={<ProductDetailsPage />} />
          <Route path="/try-on/:slug" element={<TryOnPage />} />
          <Route path="/style-quiz" element={<StyleQuizPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/wishlist/collections" element={<WishlistCollectionsPage />} />
          <Route path="/wishlist/shared/:token" element={<SharedWishlistPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/compare" element={<ComparePage />} />

          <Route path="/help-center" element={<HelpCenterPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/checkout/payment" element={<PaymentPage />} />
            <Route path="/order-success/:orderId" element={<OrderSuccessPage />} />
            <Route path="/track-order" element={<TrackOrderPage />} />

            <Route element={<AccountLayout />}>
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/orders/:orderId" element={<OrderDetailsPage />} />
              <Route path="/addresses" element={<AddressesPage />} />
              <Route path="/saved-payments" element={<SavedPaymentsPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/coupons" element={<CouponsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/rewards" element={<RewardsPage />} />
              <Route path="/referrals" element={<ReferralsPage />} />
            </Route>
          </Route>
        </Route>

        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/verify-otp" element={<OtpVerificationPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>

        {/* Dedicated, standalone logins for the Admin Panel and Staff Portal — self-contained
            pages (own branding, no shared layout), each rejecting/signing-out any role that
            doesn't match its own portal. See AdminLoginPage/StaffLoginPage. */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/staff/login" element={<StaffLoginPage />} />

        {/* Hidden admin panel — never linked from customer nav. Wrong role hitting /admin gets a
            403 rendered right here, not a redirect, so its existence can't be inferred from where
            you land. */}
        <Route element={<RequireRole roles={BACKEND_ROLES} />}>
          {/* /admin/dashboard is an alias for /admin (the canonical dashboard route, and the root
              every other /admin/* NavLink in AdminLayout is relative to) — kept so a direct link
              to /admin/dashboard still lands correctly. */}
          <Route path="/admin/dashboard" element={<Navigate to="/admin" replace />} />
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/products" element={<AdminProductsPage />} />
            <Route path="/admin/products/new" element={<AdminProductFormPage />} />
            <Route path="/admin/products/:id/edit" element={<AdminProductFormPage />} />
            <Route path="/admin/categories" element={<AdminCategoriesPage />} />
            <Route path="/admin/inventory" element={<AdminInventoryPage />} />
            <Route path="/admin/orders" element={<AdminOrdersPage />} />
            <Route path="/admin/customers" element={<AdminCustomersPage />} />
            <Route path="/admin/customers/:id" element={<AdminCustomerDetailPage />} />
            <Route path="/admin/returns" element={<AdminReturnsPage />} />
            <Route path="/admin/offers" element={<AdminOffersPage />} />
            <Route path="/admin/coupons" element={<AdminCouponsPage />} />
            <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
            <Route path="/admin/reports" element={<AdminReportsPage />} />
            <Route path="/admin/staff-products" element={<AdminStaffProductsPage />} />
            <Route path="/admin/staff" element={<AdminStaffPage />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
          </Route>
        </Route>

        {/* Staff Portal — a fully separate application from the Admin Panel, role === 'staff'
            only (admin/shop_owner are explicitly excluded, see RequireStaffOnly). Unlike /admin's
            403-at-the-same-URL gate, wrong roles here are redirected away (customer → "/",
            admin/shop_owner → "/admin") per the Staff Portal spec. */}
        <Route element={<RequireStaffOnly />}>
          <Route element={<StaffLayout />}>
            <Route path="/staff/dashboard" element={<StaffDashboardPage />} />
            <Route path="/staff/products" element={<StaffProductsPage />} />
            <Route path="/staff/products/new" element={<StaffProductFormPage />} />
            <Route path="/staff/products/:id/edit" element={<StaffProductFormPage />} />
            <Route path="/staff/inventory" element={<StaffInventoryPage />} />
            <Route path="/staff/profile" element={<StaffProfilePage />} />
            <Route path="/staff/settings" element={<StaffSettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
