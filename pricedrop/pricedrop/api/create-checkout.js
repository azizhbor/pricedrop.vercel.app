export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { itemId, itemName, refundAmount, myEarning } = req.body;
    const amount = Number(myEarning || refundAmount * 0.25).toFixed(2);

    const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
    const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
    const PAYPAL_API = "https://api-m.paypal.com";
    const APP_URL = req.headers.origin || "https://pricedrop-goq6.vercel.app";

    if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
      return res.status(500).json({ error: "PayPal keys not configured" });
    }

    var authRes = await fetch(PAYPAL_API + "/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + Buffer.from(PAYPAL_CLIENT_ID + ":" + PAYPAL_SECRET).toString("base64")
      },
      body: "grant_type=client_credentials"
    });

    var authData = await authRes.json();

    if (!authData.access_token) {
      return res.status(500).json({ error: "PayPal auth failed", details: authData });
    }

    var orderRes = await fetch(PAYPAL_API + "/v2/checkout/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + authData.access_token
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            description: "PriceDrop fee - " + (itemName || "Refund claim"),
            amount: {
              currency_code: "USD",
              value: amount
            }
          }
        ],
        application_context: {
          return_url: APP_URL + "?success=true&itemId=" + itemId,
          cancel_url: APP_URL + "?cancelled=true",
          brand_name: "PriceDrop",
          user_action: "PAY_NOW"
        }
      })
    });

    var orderData = await orderRes.json();
    var approveLink = null;

    if (orderData.links) {
      for (var i = 0; i < orderData.links.length; i++) {
        if (orderData.links[i].rel === "approve") {
          approveLink = orderData.links[i].href;
          break;
        }
      }
    }

    if (approveLink) {
      return res.status(200).json({ url: approveLink });
    }

    return res.status(500).json({ error: "No PayPal approval link", details: orderData });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
