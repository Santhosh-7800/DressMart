export interface AddressFormValues {
  full_name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string;
  type: 'home' | 'work' | 'other';
}

export const SERVICEABLE_STATE = 'Telangana';

export const EMPTY_ADDRESS_FORM: AddressFormValues = {
  full_name: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: SERVICEABLE_STATE,
  pincode: '',
  landmark: '',
  type: 'home',
};

const PHONE_REGEX = /^[6-9]\d{9}$/;
const PINCODE_REGEX = /^\d{6}$/;

export type AddressFormErrors = Partial<Record<keyof AddressFormValues, string>>;

export function getAddressFormErrors(form: AddressFormValues): AddressFormErrors {
  const errors: AddressFormErrors = {};

  if (!form.full_name.trim()) errors.full_name = 'Full name is required';

  if (!form.phone.trim()) errors.phone = 'Phone number is required';
  else if (!PHONE_REGEX.test(form.phone.trim())) errors.phone = 'Enter a valid 10-digit Indian mobile number';

  if (!form.line1.trim()) errors.line1 = 'Address line 1 is required';

  if (!form.city.trim()) errors.city = 'City is required';

  if (!form.state.trim()) errors.state = 'State is required';
  else if (form.state !== SERVICEABLE_STATE) errors.state = `Only ${SERVICEABLE_STATE} is currently serviceable`;

  if (!form.pincode.trim()) errors.pincode = 'Pincode is required';
  else if (!PINCODE_REGEX.test(form.pincode.trim())) errors.pincode = 'Pincode must be exactly 6 digits';

  return errors;
}

export function isAddressFormValid(form: AddressFormValues): boolean {
  return Object.keys(getAddressFormErrors(form)).length === 0;
}
