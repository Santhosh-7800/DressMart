import { Link } from 'react-router-dom';
import { AnimatedOutlet } from '@/components/common/PageTransition';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen bg-surface dark:bg-surface-dark">
      <div className="hidden w-1/2 flex-col items-center justify-center bg-primary-900 p-12 text-white lg:flex">
        <Link to="/" className="text-4xl font-bold">
          Dress<span className="text-accent">Mart</span>
        </Link>
        <p className="mt-4 text-center text-primary-200">Premium fashion for Men &amp; Kids</p>
        <p className="absolute bottom-8 text-sm text-primary-300">&copy; {new Date().getFullYear()} DressMart. All rights reserved.</p>
      </div>
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2 sm:p-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 block text-center text-2xl font-bold text-primary-900 dark:text-white lg:hidden">
            Dress<span className="text-accent">Mart</span>
          </Link>
          <AnimatedOutlet />
        </div>
      </div>
    </div>
  );
}
