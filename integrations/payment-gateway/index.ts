/**
 * Payment Gateway Integration
 * 
 * Complete example of integrating Veridex with a payment gateway contract.
 * Shows both merchant setup and customer payment flow.
 * 
 * Run: npx ts-node integrations/payment-gateway/index.ts
 */

import { createSDK } from 'veridex-sdk';
import { parseEther, parseUnits, formatEther, ethers } from 'ethers';

// Payment Gateway contract ABI (simplified)
const GATEWAY_ABI = [
    'function registerMerchant(address vault, string name) external',
    'function createInvoice(address token, uint256 amount, string reference, uint256 expiresIn) external returns (bytes32)',
    'function payInvoice(bytes32 invoiceId) external payable',
    'function payInvoiceWithToken(bytes32 invoiceId, uint256 amount) external',
    'function getInvoice(bytes32 invoiceId) external view returns (tuple(bytes32 id, address merchant, address token, uint256 amount, uint256 paidAmount, uint256 createdAt, uint256 expiresAt, string reference, uint8 status, address payer, uint256 paidAt))',
    'function getMerchantInvoices(address merchant) external view returns (bytes32[])',
    'event InvoiceCreated(bytes32 indexed invoiceId, address indexed merchant, address token, uint256 amount, string reference)',
    'event InvoicePaid(bytes32 indexed invoiceId, address indexed payer, uint256 amount, uint256 fee)',
];

// Contract address (deploy using the example contract)
const GATEWAY_ADDRESS = process.env.GATEWAY_ADDRESS || '0x...';

async function main() {
    console.log('💳 Veridex Payment Gateway Integration\n');
    console.log('='.repeat(60));

    // =========================================================================
    // Part 1: Merchant Setup
    // =========================================================================
    
    console.log('\n📦 PART 1: MERCHANT SETUP');
    console.log('='.repeat(60));

    // Merchant creates their Veridex wallet
    const merchantSdk = createSDK('base', {
        relayerUrl: process.env.RELAYER_URL,
    });

    console.log('\n🔐 Merchant registering passkey...');
    await merchantSdk.passkey.register('merchant@mystore.com', 'My Online Store');
    
    const merchantVault = merchantSdk.getVaultAddress();
    console.log(`✅ Merchant vault: ${merchantVault}`);

    // Register with payment gateway
    console.log('\n📝 Registering with payment gateway...');
    
    const gatewayInterface = new ethers.Interface(GATEWAY_ABI);
    const registerData = gatewayInterface.encodeFunctionData('registerMerchant', [
        merchantVault,
        'My Online Store',
    ]);

    const registerResult = await merchantSdk.execute({
        target: GATEWAY_ADDRESS,
        data: registerData,
        value: 0n,
    });

    console.log(`✅ Merchant registered! TX: ${registerResult.transactionHash}`);

    // =========================================================================
    // Part 2: Create Invoice
    // =========================================================================
    
    console.log('\n📦 PART 2: CREATE INVOICE');
    console.log('='.repeat(60));

    console.log('\n📄 Creating invoice for $100 order...');

    const createInvoiceData = gatewayInterface.encodeFunctionData('createInvoice', [
        ethers.ZeroAddress, // Native token (ETH)
        parseEther('0.05'), // Amount in ETH
        'ORDER-2024-001',   // Reference
        86400,              // Expires in 24 hours
    ]);

    const invoiceResult = await merchantSdk.execute({
        target: GATEWAY_ADDRESS,
        data: createInvoiceData,
        value: 0n,
    });

    // Parse InvoiceCreated event to get invoice ID
    const invoiceId = parseInvoiceCreatedEvent(invoiceResult.logs);
    
    console.log(`✅ Invoice created!`);
    console.log(`   Invoice ID: ${invoiceId}`);
    console.log(`   Amount: 0.05 ETH`);
    console.log(`   Reference: ORDER-2024-001`);
    console.log(`   Expires: 24 hours`);

    // Generate payment link
    const paymentLink = generatePaymentLink(invoiceId);
    console.log(`\n🔗 Payment Link: ${paymentLink}`);
    console.log(`   (Send this to customer)`);

    // =========================================================================
    // Part 3: Customer Payment
    // =========================================================================
    
    console.log('\n📦 PART 3: CUSTOMER PAYMENT');
    console.log('='.repeat(60));

    // Customer creates their Veridex wallet
    const customerSdk = createSDK('base', {
        relayerUrl: process.env.RELAYER_URL,
    });

    console.log('\n🔐 Customer registering passkey...');
    await customerSdk.passkey.register('customer@email.com', 'My Wallet');
    
    const customerVault = customerSdk.getVaultAddress();
    console.log(`✅ Customer vault: ${customerVault}`);

    // Check balance
    const balance = await customerSdk.getBalance('native');
    console.log(`   Balance: ${formatEther(balance)} ETH`);

    if (balance < parseEther('0.05')) {
        console.log('\n⚠️  Insufficient balance. Fund the customer vault first.');
        return;
    }

    // Pay invoice
    console.log('\n💸 Paying invoice...');

    const payInvoiceData = gatewayInterface.encodeFunctionData('payInvoice', [
        invoiceId,
    ]);

    const payResult = await customerSdk.execute({
        target: GATEWAY_ADDRESS,
        data: payInvoiceData,
        value: parseEther('0.05'),
    });

    console.log(`✅ Invoice paid!`);
    console.log(`   TX: ${payResult.transactionHash}`);

    // =========================================================================
    // Part 4: Verify Payment
    // =========================================================================
    
    console.log('\n📦 PART 4: VERIFY PAYMENT');
    console.log('='.repeat(60));

    // Merchant checks invoice status
    console.log('\n🔍 Checking invoice status...');

    const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
    const gatewayContract = new ethers.Contract(GATEWAY_ADDRESS, GATEWAY_ABI, provider);
    
    const invoice = await gatewayContract.getInvoice(invoiceId);
    
    console.log(`\n📋 Invoice Details:`);
    console.log(`   ID: ${invoice.id}`);
    console.log(`   Status: ${getStatusString(invoice.status)}`);
    console.log(`   Amount: ${formatEther(invoice.amount)} ETH`);
    console.log(`   Paid: ${formatEther(invoice.paidAmount)} ETH`);
    console.log(`   Payer: ${invoice.payer}`);
    console.log(`   Paid At: ${new Date(Number(invoice.paidAt) * 1000).toISOString()}`);

    // Check merchant balance
    const merchantBalance = await merchantSdk.getBalance('native', { forceRefresh: true });
    console.log(`\n💰 Merchant balance: ${formatEther(merchantBalance)} ETH`);

    console.log('\n🎉 Payment flow complete!');
}

// ============================================================================
// Helper Functions
// ============================================================================

function parseInvoiceCreatedEvent(logs: ethers.Log[]): string {
    const iface = new ethers.Interface(GATEWAY_ABI);
    for (const log of logs) {
        try {
            const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
            if (parsed?.name === 'InvoiceCreated') {
                return parsed.args.invoiceId;
            }
        } catch {
            continue;
        }
    }
    throw new Error('InvoiceCreated event not found');
}

function generatePaymentLink(invoiceId: string): string {
    // In production, this would be your payment page URL
    return `https://pay.mystore.com/invoice/${invoiceId}`;
}

function getStatusString(status: number): string {
    const statuses = ['Pending', 'Paid', 'PartiallyPaid', 'Expired', 'Cancelled', 'Refunded'];
    return statuses[status] || 'Unknown';
}

// ============================================================================
// Webhook Integration Example
// ============================================================================

async function webhookExample() {
    console.log('\n' + '='.repeat(60));
    console.log('🔔 WEBHOOK INTEGRATION');
    console.log('='.repeat(60));

    console.log(`
When integrating with your backend:

1. PAYMENT NOTIFICATION
   Listen for InvoicePaid events from the gateway contract.
   
   \`\`\`javascript
   const filter = gateway.filters.InvoicePaid();
   gateway.on(filter, (invoiceId, payer, amount, fee) => {
       // Verify payment
       const invoice = await gateway.getInvoice(invoiceId);
       
       // Notify your backend
       await fetch('https://api.mystore.com/webhooks/payment', {
           method: 'POST',
           body: JSON.stringify({
               invoiceId,
               reference: invoice.reference,
               amount: amount.toString(),
               payer,
               timestamp: Date.now(),
           }),
       });
   });
   \`\`\`

2. ORDER FULFILLMENT
   \`\`\`javascript
   app.post('/webhooks/payment', async (req, res) => {
       const { invoiceId, reference, amount } = req.body;
       
       // Find order by reference
       const order = await Order.findOne({ reference });
       
       // Update order status
       order.status = 'paid';
       order.paymentHash = invoiceId;
       await order.save();
       
       // Trigger fulfillment
       await fulfillOrder(order);
       
       res.json({ success: true });
   });
   \`\`\`

3. REFUND FLOW
   \`\`\`javascript
   // Merchant refunds via their vault
   const refundData = gatewayInterface.encodeFunctionData('refundInvoice', [
       invoiceId,
   ]);
   
   await merchantSdk.execute({
       target: GATEWAY_ADDRESS,
       data: refundData,
       value: 0n,
   });
   \`\`\`
    `);
}

// ============================================================================
// Point of Sale Example
// ============================================================================

async function pointOfSaleExample() {
    console.log('\n' + '='.repeat(60));
    console.log('🏪 POINT OF SALE INTEGRATION');
    console.log('='.repeat(60));

    console.log(`
For in-store payments:

1. MERCHANT TERMINAL
   - Merchant app generates invoice with QR code
   - QR code contains payment link with invoice ID
   
2. CUSTOMER PAYMENT
   - Customer scans QR with their Veridex app
   - App shows invoice details
   - Customer confirms with biometric (passkey)
   - Payment executes instantly
   
3. CONFIRMATION
   - Terminal receives payment confirmation
   - Receipt printed / emailed
   
Example QR Code Data:
{
  "version": 1,
  "type": "veridex-payment",
  "chain": "base",
  "gateway": "${GATEWAY_ADDRESS}",
  "invoiceId": "0x...",
  "amount": "0.05",
  "token": "ETH",
  "merchant": "My Store"
}
    `);
}

// Run example
main()
    .then(() => webhookExample())
    .then(() => pointOfSaleExample())
    .catch(console.error);
