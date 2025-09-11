import { Button } from "@/components/ui/button";

export default function PaymentPage() {
  const startPayment = async () => {
    const order = await fetch("http://localhost:5000/create-order", {
      method: "POST",
    }).then((res) => res.json());

    const options = {
      key: "YOUR_RAZORPAY_KEY_ID",
      amount: order.amount,
      currency: order.currency,
      name: "My App",
      description: "Trial Plan Payment",
      order_id: order.id,
      handler: function (response: any) {
        alert("Payment successful! Payment ID: " + response.razorpay_payment_id);
      },
      prefill: {
        name: "Yash Dubey",
        email: "yash@example.com",
        contact: "9999999999",
      },
      theme: {
        color: "#7C3AED", // modern purple theme
      },
    };

    const rzp = new (window as any).Razorpay(options);
    rzp.open();
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-3xl font-bold mb-6">Start Your Trial</h1>
      <Button onClick={startPayment} className="bg-purple-600 hover:bg-purple-700">
        Pay with UPI / GPay / Paytm / PhonePe
      </Button>
    </div>
  );
}
