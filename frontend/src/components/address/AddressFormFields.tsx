import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { pincodeService, type LocalitySuggestion } from '@/services/pincodeService';
import { AutocompleteList } from '@/components/ui/AutocompleteList';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { getAddressFormErrors, SERVICEABLE_STATE, type AddressFormValues } from '@/lib/addressValidation';

interface AddressFormFieldsProps {
  value: AddressFormValues;
  onChange: (next: AddressFormValues) => void;
  /** Show every validation error, not just for fields the user has already left. Set once a save attempt fails. */
  submitAttempted?: boolean;
}

export function AddressFormFields({ value, onChange, submitAttempted }: AddressFormFieldsProps) {
  const valueRef = useRef(value);
  valueRef.current = value;

  const [touched, setTouched] = useState<Partial<Record<keyof AddressFormValues, boolean>>>({});
  const errors = getAddressFormErrors(value);
  const showError = (field: keyof AddressFormValues) => (submitAttempted || touched[field] ? errors[field] : undefined);
  const markTouched = (field: keyof AddressFormValues) => setTouched((t) => ({ ...t, [field]: true }));

  // City autocomplete — local, instant Telangana city list.
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [cityActiveIndex, setCityActiveIndex] = useState(-1);
  const citySuggestions = pincodeService.searchTelanganaCities(value.city);

  // Address Line 1 autocomplete — debounced remote locality search, restricted to Telangana.
  const [addressSuggestions, setAddressSuggestions] = useState<LocalitySuggestion[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);
  const [addressActiveIndex, setAddressActiveIndex] = useState(-1);
  const latestAddressQueryRef = useRef('');

  useEffect(() => {
    const q = value.line1.trim();
    latestAddressQueryRef.current = q;
    if (q.length < 3) {
      setAddressSuggestions([]);
      setIsSearchingAddress(false);
      return;
    }
    setIsSearchingAddress(true);
    const timeout = setTimeout(async () => {
      const results = await pincodeService.searchLocalities(q);
      if (latestAddressQueryRef.current === q) {
        setAddressSuggestions(results);
        setIsSearchingAddress(false);
      }
    }, 350);
    return () => clearTimeout(timeout);
  }, [value.line1]);

  // Pincode auto-fill — only ever overwrites a pincode the form itself last filled in, never one the user typed.
  const [isResolvingPincode, setIsResolvingPincode] = useState(false);
  const autoFilledPincodeRef = useRef<string | null>(null);

  const applyAutoFilledPincode = (pincode: string) => {
    autoFilledPincodeRef.current = pincode;
    onChange({ ...valueRef.current, pincode });
  };

  const resolvePincodeForCity = async (city: string) => {
    if (valueRef.current.pincode && valueRef.current.pincode !== autoFilledPincodeRef.current) return;
    setIsResolvingPincode(true);
    const pincode = await pincodeService.lookupPincodeForCity(city);
    setIsResolvingPincode(false);
    if (pincode) applyAutoFilledPincode(pincode);
  };

  const selectCity = (city: string) => {
    onChange({ ...value, city });
    setShowCityDropdown(false);
    void resolvePincodeForCity(city);
  };

  const selectAddressSuggestion = (suggestion: LocalitySuggestion) => {
    onChange({ ...value, line1: suggestion.name, city: suggestion.city, state: SERVICEABLE_STATE, pincode: suggestion.pincode });
    autoFilledPincodeRef.current = suggestion.pincode;
    setShowAddressDropdown(false);
  };

  const handleCityKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showCityDropdown || citySuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCityActiveIndex((i) => Math.min(i + 1, citySuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCityActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && cityActiveIndex >= 0) {
      e.preventDefault();
      selectCity(citySuggestions[cityActiveIndex]);
    } else if (e.key === 'Escape') {
      setShowCityDropdown(false);
    }
  };

  const handleAddressKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showAddressDropdown || addressSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAddressActiveIndex((i) => Math.min(i + 1, addressSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAddressActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && addressActiveIndex >= 0) {
      e.preventDefault();
      selectAddressSuggestion(addressSuggestions[addressActiveIndex]);
    } else if (e.key === 'Escape') {
      setShowAddressDropdown(false);
    }
  };

  return (
    <div className="space-y-3">
      <Input
        name="full_name"
        label="Full Name"
        value={value.full_name}
        onChange={(e) => onChange({ ...value, full_name: e.target.value })}
        onBlur={() => markTouched('full_name')}
        error={showError('full_name')}
      />
      <Input
        name="phone"
        label="Phone Number"
        inputMode="numeric"
        maxLength={10}
        value={value.phone}
        onChange={(e) => onChange({ ...value, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
        onBlur={() => markTouched('phone')}
        error={showError('phone')}
      />

      <div className="relative">
        <Input
          name="line1"
          label="Address Line 1"
          autoComplete="off"
          value={value.line1}
          onChange={(e) => {
            onChange({ ...value, line1: e.target.value });
            setShowAddressDropdown(true);
            setAddressActiveIndex(-1);
          }}
          onFocus={() => setShowAddressDropdown(true)}
          onBlur={() => {
            markTouched('line1');
            setShowAddressDropdown(false);
          }}
          onKeyDown={handleAddressKeyDown}
          error={showError('line1')}
          hint="Try a locality like Madhapur or Ameerpet"
        />
        {showAddressDropdown && value.line1.trim().length >= 3 && (isSearchingAddress || addressSuggestions.length > 0) && (
          <AutocompleteList
            items={addressSuggestions}
            isLoading={isSearchingAddress}
            activeIndex={addressActiveIndex}
            getKey={(s) => `${s.name}-${s.pincode}`}
            onHover={setAddressActiveIndex}
            onSelect={selectAddressSuggestion}
            renderItem={(s) => s.label}
          />
        )}
      </div>

      <Input
        name="line2"
        label="Address Line 2 (optional)"
        value={value.line2}
        onChange={(e) => onChange({ ...value, line2: e.target.value })}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="relative">
          <Input
            name="city"
            label="City"
            autoComplete="off"
            value={value.city}
            onChange={(e) => {
              onChange({ ...value, city: e.target.value });
              setShowCityDropdown(true);
              setCityActiveIndex(-1);
            }}
            onFocus={() => setShowCityDropdown(true)}
            onBlur={() => {
              markTouched('city');
              setShowCityDropdown(false);
            }}
            onKeyDown={handleCityKeyDown}
            error={showError('city')}
          />
          {showCityDropdown && citySuggestions.length > 0 && (
            <AutocompleteList
              items={citySuggestions}
              activeIndex={cityActiveIndex}
              getKey={(c) => c}
              onHover={setCityActiveIndex}
              onSelect={selectCity}
              renderItem={(c) => c}
            />
          )}
        </div>

        <div className="w-full">
          <label htmlFor="state" className="mb-1.5 block text-sm font-medium text-primary-800 dark:text-primary-100">
            State
          </label>
          <select
            id="state"
            name="state"
            value={value.state}
            onChange={(e) => onChange({ ...value, state: e.target.value })}
            onBlur={() => markTouched('state')}
            className={cn('input-field', showError('state') && 'border-red-500 focus:border-red-500')}
          >
            <option value={SERVICEABLE_STATE}>{SERVICEABLE_STATE}</option>
          </select>
          {showError('state') && <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{showError('state')}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          name="pincode"
          label="Pincode"
          inputMode="numeric"
          maxLength={6}
          value={value.pincode}
          onChange={(e) => {
            autoFilledPincodeRef.current = null;
            onChange({ ...value, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) });
          }}
          onBlur={() => markTouched('pincode')}
          error={showError('pincode')}
          rightIcon={isResolvingPincode ? <Loader2 size={15} className="animate-spin" /> : undefined}
        />
        <Input name="landmark" label="Landmark (optional)" value={value.landmark} onChange={(e) => onChange({ ...value, landmark: e.target.value })} />
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium">Address Type</p>
        <div className="flex gap-2">
          {(['home', 'work', 'other'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onChange({ ...value, type })}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs capitalize',
                value.type === type ? 'border-accent bg-accent-50 dark:bg-accent-900/10' : 'border-primary-200 dark:border-primary-600',
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
