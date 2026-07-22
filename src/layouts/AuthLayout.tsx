import { Link } from 'react-router-dom';
import { AnimatedOutlet } from '@/components/common/PageTransition';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen bg-surface dark:bg-surface-dark">
      <div className="hidden flex-1 flex-col justify-between bg-primary p-12 text-white lg:flex">
        <Link to="/" className="text-2xl font-bold">
          Dress<span className="text-accent">Mart</span>
        </Link>
        <div>
          <h1 className="text-3xl font-bold leading-tight">
            Premium fashion
            <br />
            for Men &amp; Kids
          </h1>
          <p className="mt-4 max-w-sm text-primary-200">
            Discover curated collections, exclusive deals and a shopping experience built for you.
          </p>
        </div>
        <p className="text-xs text-primary-400">© {new Date().getFullYear()} DressMart. All rights reserved.</p>
      </div>
      <div className="flex flex-1 items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 block text-center text-2xl font-bold text-primary-900 lg:hidden dark:text-white">
            Dress<span className="text-accent">Mart</span>
          </Link>
          <AnimatedOutlet />
        </div>
      </div>
    </div>
  );
}
