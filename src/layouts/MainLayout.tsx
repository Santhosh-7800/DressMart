import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CompareBar } from '@/components/product/CompareBar';
import { AnimatedOutlet, useOuterTransitionKey } from '@/components/common/PageTransition';

export function MainLayout() {
  const transitionKey = useOuterTransitionKey();

  return (
    <div className="flex min-h-screen flex-col bg-surface dark:bg-surface-dark">
      <Header />
      <main className="flex-1">
        <AnimatedOutlet transitionKey={transitionKey} />
      </main>
      <Footer />
      <CompareBar />
    </div>
  );
}
