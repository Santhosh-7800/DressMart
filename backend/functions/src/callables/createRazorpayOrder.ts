import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { razorpayKeyId, razorpayKeySecret } from '../lib/config';
import { getRazorpayClient } from '../lib/razorpay';

interface CreateRazorpayOrderData {
  amount: number; // whole rupees
  receipt: string;
}

interface CreateRazorpayOrderResult {
  razorpayOrderId: string;
  amount: number; // paise
  currency: 'INR';
  keyId: string;
}

export const createRazorpayOrder = onCall<CreateRazorpayOrderData>(
  { secrets: [razorpayKeySecret] },
  async (request): Promise<CreateRazorpayOrderResult> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in to start a payment.');
    }

    const { amount, receipt } = request.data ?? ({} as CreateRazorpayOrderData);
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      throw new HttpsError('invalid-argument', 'A positive amount (in rupees) is required.');
    }
    if (typeof receipt !== 'string' || !receipt) {
      throw new HttpsError('invalid-argument', 'receipt is required.');
    }

    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt,
    });

    return {
      razorpayOrderId: order.id,
      amount: Number(order.amount),
      currency: 'INR',
      keyId: razorpayKeyId.value(),
    };
  },
);
