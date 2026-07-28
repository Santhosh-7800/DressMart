import { useLocation } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { BottomNavBar } from '@/components/layout/BottomNavBar';
import { AnimatedOutlet, useOuterTransitionKey } from '@/components/common/PageTransition';

export function MainLayout() {
  const transitionKey = useOuterTransitionKey();
  const location = useLocation();
  // Seller/Head-Seller (SellerLayout) and Login/Signup (AuthLayout) never render MainLayout at
  // all, so they're already excluded — checkout is the one MainLayout route that still needs its
  // own explicit hide, since a fixed bottom tab bar competing with the payment/place-order flow's
  // own sticky bottom actions would be confusing.
  const hideBottomNav = location.pathname.startsWith('/checkout');

  return (
    <div className="flex min-h-screen flex-col bg-surface dark:bg-surface-dark">
      <Header />
      <main className={hideBottomNav ? 'flex-1' : 'flex-1 pb-16 md:pb-0'}>
        <AnimatedOutlet transitionKey={transitionKey} />
      </main>
      <Footer />
      {!hideBottomNav && <BottomNavBar />}
    </div>
  );
}
