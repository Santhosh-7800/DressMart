import type { PaymentMethod } from '@/types';

/**
 * Payment gateway abstraction. Each method implements the same interface so a
 * real provider (Razorpay, Stripe, PayU, etc.) can be dropped in later by
 * replacing the `process()` body — nothing in checkout/order code needs to change.
 */
export interface PaymentChargeInput {
  amount: number;
  currency: 'INR';
  orderNumber: string;
  method: PaymentMethod;
  details?: {
    upiId?: string;
    cardNumber?: string;
    cardExpiry?: string;
    cardCvv?: string;
    cardHolderName?: string;
    bankCode?: string;
    walletProvider?: string;
  };
}

export interface PaymentChargeResult {
  success: boolean;
  transactionId: string;
  method: PaymentMethod;
  message: string;
}

interface PaymentGateway {
  process(input: PaymentChargeInput): Promise<PaymentChargeResult>;
}

function simulateLatency(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 900 + Math.random() * 600));
}

function fakeTransactionId(prefix: string): string {
  return `${prefix}_${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

class UpiGateway implements PaymentGateway {
  async process(input: PaymentChargeInput): Promise<PaymentChargeResult> {
    await simulateLatency();
    if (!input.details?.upiId?.includes('@')) {
      return { success: false, transactionId: '', method: 'upi', message: 'Enter a valid UPI ID (e.g. name@bank).' };
    }
    return { success: true, transactionId: fakeTransactionId('UPI'), method: 'upi', message: 'Payment approved via UPI.' };
  }
}

class CardGateway implements PaymentGateway {
  constructor(private method: 'credit_card' | 'debit_card') {}

  async process(input: PaymentChargeInput): Promise<PaymentChargeResult> {
    await simulateLatency();
    const cardNumber = input.details?.cardNumber?.replace(/\s/g, '') ?? '';
    if (cardNumber.length < 12) {
      return { success: false, transactionId: '', method: this.method, message: 'Enter a valid card number.' };
    }
    return { success: true, transactionId: fakeTransactionId('CARD'), method: this.method, message: 'Payment approved.' };
  }
}

class NetBankingGateway implements PaymentGateway {
  async process(input: PaymentChargeInput): Promise<PaymentChargeResult> {
    await simulateLatency();
    if (!input.details?.bankCode) {
      return { success: false, transactionId: '', method: 'net_banking', message: 'Select a bank to continue.' };
    }
    return { success: true, transactionId: fakeTransactionId('NB'), method: 'net_banking', message: 'Payment approved via net banking.' };
  }
}

class WalletGateway implements PaymentGateway {
  async process(input: PaymentChargeInput): Promise<PaymentChargeResult> {
    await simulateLatency();
    if (!input.details?.walletProvider) {
      return { success: false, transactionId: '', method: 'wallet', message: 'Select a wallet provider.' };
    }
    return { success: true, transactionId: fakeTransactionId('WLT'), method: 'wallet', message: 'Payment approved via wallet.' };
  }
}

class CodGateway implements PaymentGateway {
  async process(): Promise<PaymentChargeResult> {
    await simulateLatency();
    return { success: true, transactionId: fakeTransactionId('COD'), method: 'cod', message: 'Order confirmed — pay on delivery.' };
  }
}

const gateways: Record<PaymentMethod, PaymentGateway> = {
  upi: new UpiGateway(),
  credit_card: new CardGateway('credit_card'),
  debit_card: new CardGateway('debit_card'),
  net_banking: new NetBankingGateway(),
  wallet: new WalletGateway(),
  cod: new CodGateway(),
};

export const paymentService = {
  async charge(input: PaymentChargeInput): Promise<PaymentChargeResult> {
    const gateway = gateways[input.method];
    return gateway.process(input);
  },
};
