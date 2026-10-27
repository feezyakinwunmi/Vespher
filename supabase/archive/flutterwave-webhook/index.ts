// supabase/functions/flutterwave-webhook/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FLW_SECRET_KEY = Deno.env.get("FLUTTERWAVE_SECRET_KEY")!;
const FLW_SECRET_HASH = Deno.env.get("FLUTTERWAVE_SECRET_HASH")!;

serve(async (req) => {
  try {
    // Log the raw request for debugging
    console.log("📨 Webhook received at:", new Date().toISOString());
    console.log("📨 Request method:", req.method);
    console.log("📨 Request headers:", Object.fromEntries(req.headers.entries()));
    
    // Get raw body for logging
    const rawBody = await req.text();
    console.log("📨 Raw webhook body:", rawBody);
    
    const payload = JSON.parse(rawBody);
    const event = payload["event.type"] || payload.event;
    const data = payload.data;
    
    console.log("✅ Webhook parsed:", { event, tx_ref: data?.tx_ref, transaction_id: data?.id });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ============================================
    // HANDLE CHARGE COMPLETED (Payment from customer)
    // ============================================
    if (event === "charge.completed") {
      // Get order ID from tx_ref
      const txRef = data.tx_ref;
      let orderId = txRef?.replace("VESP-", "");
      
      console.log("🔍 Looking for order with ID:", orderId);
      console.log("🔍 Payment data:", {
        tx_ref: txRef,
        amount: data.amount,
        charged_amount: data.charged_amount,
        fee: data.fee,
        app_fee: data.app_fee,
        flutterwave_fee: data.flw_fee,
        transaction_id: data.id
      });

      // Try to find order by ID first
      let { data: order, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

      // If not found, try by payment_reference
      if (orderError) {
        console.log("Order not found by ID, trying by payment_reference...");
        const { data: orderByRef, error: refError } = await supabase
          .from("orders")
          .select("*")
          .eq("payment_reference", txRef)
          .single();
        
        if (orderByRef) {
          order = orderByRef;
          console.log("✅ Found order by payment_reference:", order.id);
        } else {
          console.error("❌ Order not found for tx_ref:", txRef);
          return new Response("Order not found", { status: 404 });
        }
      }

      if (!order) {
        console.error("❌ Order not found");
        return new Response("Order not found", { status: 404 });
      }

      console.log("✅ Found order:", order.id);
      console.log("💰 Current order data:", {
        id: order.id,
        flutterwave_fee: order.flutterwave_fee,
        payment_status: order.payment_status,
        total: order.total
      });

      // Get the actual fee from the webhook
      // Try different possible fee fields
      const flutterwaveFee = data.fee || data.app_fee || data.flw_fee || 0;
      const vatOnFee = data.merchant_fee || data.vat || 0;
      const stampDuty = data.stamp_duty || 0;
      const chargedAmount = data.charged_amount || data.amount;
      
      console.log("💰 Extracted fee details:", {
        flutterwaveFee,
        vatOnFee,
        stampDuty,
        chargedAmount
      });
      
      // Calculate platform commission (10% of subtotal)
      const platformCommission = Math.round(order.subtotal * 0.1);
      
      // Update net earnings with the actual fee
      // Original platform net was: platformCommission + delivery_earnings - discount - stamp_duty
      // Now subtract flutterwave fee
      const originalPlatformNet = order.platform_net_earnings || 0;
      const updatedPlatformNet = originalPlatformNet - flutterwaveFee;
      
      console.log("💰 Platform earnings calculation:", {
        originalPlatformNet,
        flutterwaveFee,
        updatedPlatformNet,
        platformCommission
      });

      // Update order with webhook data
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          payment_status: "paid",
          flutterwave_fee: flutterwaveFee,
          vat_on_fee: vatOnFee,
          stamp_duty: stampDuty,
          platform_net_earnings: updatedPlatformNet,
          flutterwave_transaction_id: data.id,
          flutterwave_settled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", order.id);

      if (updateError) {
        console.error("❌ Update error:", updateError);
        throw updateError;
      }

      console.log("✅ Order updated successfully:", order.id);
      console.log("📦 Final order values:", {
        flutterwave_fee: flutterwaveFee,
        platform_net_earnings: updatedPlatformNet,
        payment_status: "paid"
      });
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Webhook processed successfully",
        data: { flutterwaveFee, updatedPlatformNet }
      }), { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // ============================================
    // HANDLE TRANSFER COMPLETED (Vendor payout sent)
    // ============================================
    if (event === "transfer.completed") {
      const reference = data.reference;
      console.log("💰 Transfer completed webhook received:", reference);

      // Find the withdrawal by reference
      const { error } = await supabase
        .from("withdrawals")
        .update({
          status: "completed",
          processed_at: new Date().toISOString(),
          notes: `Transfer completed. Flutterwave reference: ${reference}`
        })
        .eq("reference", reference);

      if (error) {
        console.error("Error updating transfer status:", error);
        return new Response("Error updating withdrawal", { status: 500 });
      }

      console.log("✅ Withdrawal marked as completed:", reference);
      return new Response("Transfer processed successfully", { status: 200 });
    }

    // ============================================
    // HANDLE TRANSFER FAILED
    // ============================================
    if (event === "transfer.failed") {
      const reference = data.reference;
      console.log("❌ Transfer failed webhook received:", reference);

      await supabase
        .from("withdrawals")
        .update({
          status: "failed",
          notes: `Transfer failed: ${data.message || "Unknown error"}`
        })
        .eq("reference", reference);

      console.log("⚠️ Withdrawal marked as failed:", reference);
      return new Response("Transfer failed recorded", { status: 200 });
    }

    // ============================================
    // HANDLE REFUND COMPLETED
    // ============================================
    if (event === "refund.completed") {
      console.log("💰 Refund completed webhook received:", data);

      // Find order by transaction ID
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("id")
        .eq("flutterwave_transaction_id", data.transaction_id)
        .single();

      if (orderError || !order) {
        console.error("❌ Order not found for refund:", data.transaction_id);
        return new Response("Order not found", { status: 404 });
      }

      // Update order with refund status
      await supabase
        .from("orders")
        .update({
          refund_status: "completed",
          refund_completed_at: new Date().toISOString(),
          payment_status: "refunded",
          updated_at: new Date().toISOString()
        })
        .eq("id", order.id);

      console.log("✅ Refund completed for order:", order.id);
      return new Response("Refund processed successfully", { status: 200 });
    }

    // ============================================
    // UNHANDLED EVENT
    // ============================================
    console.log("Unhandled event type:", event);
    return new Response("Event ignored", { status: 200 });

  } catch (error) {
    console.error("❌ Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});