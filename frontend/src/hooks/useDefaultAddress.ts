import { useEffect } from 'react';
import { useAddresses } from './useAddresses';
import { useLocalStorage } from './useLocalStorage';

/**
 * The single reusable hook for "what's the user's current default delivery address" — every page
 * that shows a delivery pincode/estimate (Navbar, Checkout, Product Delivery Section) should derive
 * it from here rather than keeping its own copy. Backed by the exact same `useAddresses()` query
 * cache the Addresses page reads/writes, so adding, editing, deleting, or re-defaulting an address
 * is reflected the instant that mutation's cache invalidation resolves — no separate sync needed.
 *
 * It also mirrors the resolved pincode into the `dressmart:pincode`/`dressmart:selected-address-id`
 * localStorage keys that pre-existing pincode-aware surfaces (ProductDetailsPage's delivery
 * estimate, PincodeChecker, DeliveryDropdown) already read via useLocalStorage's cross-component
 * pub/sub — so this one hook is what keeps the navbar and everything else honest, without having to
 * individually update each of those call sites.
 */
export function useDefaultAddress() {
  const { addresses, isLoading } = useAddresses();
  const [pincode, setPincode] = useLocalStorage('dressmart:pincode', '400001');
  const [selectedAddressId, setSelectedAddressId] = useLocalStorage('dressmart:selected-address-id', '');

  const defaultAddress = addresses.find((a) => a.is_default) ?? null;

  useEffect(() => {
    if (!defaultAddress) return;
    if (defaultAddress.pincode !== pincode) setPincode(defaultAddress.pincode);
    if (defaultAddress.id !== selectedAddressId) setSelectedAddressId(defaultAddress.id);
    // Only re-run when the default address itself changes — reading `pincode`/`selectedAddressId`
    // here (to compare, not to react to) would otherwise fire this effect on every write it makes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultAddress?.id, defaultAddress?.pincode]);

  return { defaultAddress, isLoading };
}
