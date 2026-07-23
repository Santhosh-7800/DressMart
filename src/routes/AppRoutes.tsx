import { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { MainLayout } from '@/layouts/MainLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { AccountLayout } from '@/layouts/AccountLayout';
import { SellerLayout } from '@/layouts/SellerLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { RequireSeller } from './RequireSeller';
import { RequireHeadSeller } from './RequireHeadSeller';
import { lazyWithRetry } from '@/lib/lazyWithRetry';

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
const SettingsPage = lazyWithRetry(() => import('@/pages/profile/SettingsPage').then((m) => ({ default: m.SettingsPage })));

const HelpCenterPage = lazyWithRetry(() => import('@/pages/static/HelpCenterPage').then((m) => ({ default: m.HelpCenterPage })));
const PrivacyPolicyPage = lazyWithRetry(() => import('@/pages/static/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage })));
const TermsPage = lazyWithRetry(() => import('@/pages/static/TermsPage').then((m) => ({ default: m.TermsPage })));
const NotFoundPage = lazyWithRetry(() => import('@/pages/errors/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

// Seller pages
const SellerDashboardPage = lazyWithRetry(() => import('@/pages/seller/SellerDashboardPage').then((m) => ({ default: m.SellerDashboardPage })));
const SellerProductsPage = lazyWithRetry(() => import('@/pages/seller/SellerProductsPage').then((m) => ({ default: m.SellerProductsPage })));
const SellerProductFormPage = lazyWithRetry(() => import('@/pages/seller/SellerProductFormPage').then((m) => ({ default: m.SellerProductFormPage })));
const SellerInventoryPage = lazyWithRetry(() => import('@/pages/seller/SellerInventoryPage').then((m) => ({ default: m.SellerInventoryPage })));
const SellerOrdersPage = lazyWithRetry(() => import('@/pages/seller/SellerOrdersPage').then((m) => ({ default: m.SellerOrdersPage })));
const SellerReturnsPage = lazyWithRetry(() => import('@/pages/seller/SellerReturnsPage').then((m) => ({ default: m.SellerReturnsPage })));
const SellerExchangesPage = lazyWithRetry(() => import('@/pages/seller/SellerExchangesPage').then((m) => ({ default: m.SellerExchangesPage })));
const SellerSettingsPage = lazyWithRetry(() => import('@/pages/seller/SellerSettingsPage').then((m) => ({ default: m.SellerSettingsPage })));
const SellerSellersPage = lazyWithRetry(() => import('@/pages/seller/SellerSellersPage').then((m) => ({ default: m.SellerSellersPage })));
const SellerAnalyticsPage = lazyWithRetry(() => import('@/pages/seller/SellerAnalyticsPage').then((m) => ({ default: m.SellerAnalyticsPage })));
const SellerReportsPage = lazyWithRetry(() => import('@/pages/seller/SellerReportsPage').then((m) => ({ default: m.SellerReportsPage })));
const SellerCouponsPage = lazyWithRetry(() => import('@/pages/seller/SellerCouponsPage').then((m) => ({ default: m.SellerCouponsPage })));
const SellerPlatformSettingsPage = lazyWithRetry(() => import('@/pages/seller/SellerPlatformSettingsPage').then((m) => ({ default: m.SellerPlatformSettingsPage })));
const SellerApplyPage = lazyWithRetry(() => import('@/pages/seller/SellerApplyPage').then((m) => ({ default: m.SellerApplyPage })));

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
            <Route path="/sell" element={<SellerApplyPage />} />

            <Route element={<AccountLayout />}>
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/orders/:orderId" element={<OrderDetailsPage />} />
              <Route path="/addresses" element={<AddressesPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/coupons" element={<CouponsPage />} />
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
        </Route>

        {/* Seller Dashboard Routes */}
        <Route element={<RequireSeller />}>
          <Route element={<SellerLayout />}>
            <Route path="/seller/dashboard" element={<SellerDashboardPage />} />
            <Route path="/seller/products" element={<SellerProductsPage />} />
            <Route path="/seller/products/new" element={<SellerProductFormPage />} />
            <Route path="/seller/products/:id/edit" element={<SellerProductFormPage />} />
            <Route path="/seller/inventory" element={<SellerInventoryPage />} />
            <Route path="/seller/orders" element={<SellerOrdersPage />} />
            <Route path="/seller/returns" element={<SellerReturnsPage />} />
            <Route path="/seller/exchanges" element={<SellerExchangesPage />} />
            <Route path="/seller/settings" element={<SellerSettingsPage />} />

            {/* Head Seller (Admin) only routes */}
            <Route element={<RequireHeadSeller />}>
              <Route path="/seller/sellers" element={<SellerSellersPage />} />
              <Route path="/seller/analytics" element={<SellerAnalyticsPage />} />
              <Route path="/seller/reports" element={<SellerReportsPage />} />
              <Route path="/seller/coupons" element={<SellerCouponsPage />} />
              <Route path="/seller/platform-settings" element={<SellerPlatformSettingsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
