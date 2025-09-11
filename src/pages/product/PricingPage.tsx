import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Star, Zap, Award, Users, Building, School } from "lucide-react";

export default function PricingPage() {
  const [audience, setAudience] = useState("individual");
  const [billingPeriod, setBillingPeriod] = useState("monthly");
  const navigate = useNavigate();

  const plans = {
    individual: [
      {
        name: "Starter",
        price: { monthly: "₹499", yearly: "₹4,999" },
        description: "Perfect for individual teachers starting out",
        features: [
          "Unlimited Test Generation",
          "Basic Student Analytics",
          "Notes Recommendations",
          "Up to 50 students",
          "Email support",
        ],
        popular: false,
      },
      {
        name: "Teacher Pro",
        price: { monthly: "₹999", yearly: "₹9,999" },
        description: "For professional educators",
        features: [
          "All Starter features",
          "Advanced Analytics",
          "Custom Test Branding",
          "Up to 200 students",
          "Priority support",
          "PDF Export",
          "Question Bank Access",
        ],
        popular: true,
      },
      {
        name: "Master Educator",
        price: { monthly: "₹1,999", yearly: "₹19,999" },
        description: "For top-tier teaching professionals",
        features: [
          "All Pro features",
          "Unlimited students",
          "AI-Powered Insights",
          "Parent Portal Access",
          "24/7 Phone support",
          "Custom Integrations",
          "Early Feature Access",
        ],
        popular: false,
      },
    ],
    institute: [
      {
        name: "Institute Basic",
        price: { monthly: "₹4,999", yearly: "₹49,999" },
        description: "For small coaching centers",
        features: [
          "Up to 5 teachers",
          "Institute Analytics Dashboard",
          "Contest Hosting",
          "Branded Certificates",
          "Basic Reporting",
          "500 student capacity",
        ],
        popular: false,
      },
      {
        name: "Institute Growth",
        price: { monthly: "₹8,999", yearly: "₹89,999" },
        description: "For growing institutes",
        features: [
          "All Basic features",
          "Up to 15 teachers",
          "Advanced Reporting",
          "Performance Benchmarking",
          "1,500 student capacity",
          "API Access",
          "Custom Domain",
        ],
        popular: true,
      },
      {
        name: "Institute Elite",
        price: { monthly: "₹14,999", yearly: "₹149,999" },
        description: "For premium coaching institutes",
        features: [
          "All Growth features",
          "Unlimited teachers",
          "Unlimited students",
          "White-label Solution",
          "Dedicated Account Manager",
          "SSO Integration",
          "Custom Development Hours",
        ],
        popular: false,
      },
    ],
    school: [
      {
        name: "School Standard",
        price: { monthly: "₹19,999", yearly: "₹199,999" },
        description: "For small to medium schools",
        features: [
          "Up to 25 teachers",
          "School-wide Dashboard",
          "Parent & Admin Portals",
          "Custom Report Cards",
          "1,000 student capacity",
          "Basic SIS Integration",
        ],
        popular: false,
      },
      {
        name: "School Premium",
        price: { monthly: "₹34,999", yearly: "₹349,999" },
        description: "For large schools",
        features: [
          "All Standard features",
          "Up to 75 teachers",
          "Advanced Analytics Suite",
          "Custom Integrations",
          "5,000 student capacity",
          "Training & Onboarding",
          "99.9% Uptime SLA",
        ],
        popular: true,
      },
      {
        name: "School Enterprise",
        price: { monthly: "₹59,999", yearly: "₹599,999" },
        description: "For educational networks & groups",
        features: [
          "All Premium features",
          "Unlimited teachers & students",
          "Multi-school Management",
          "Dedicated Infrastructure",
          "Custom Feature Development",
          "24/7 Premium Support",
          "On-site Training",
        ],
        popular: false,
      },
    ],
  };

  const savingsNote = billingPeriod === "yearly" ? "(Save 17%)" : "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 text-foreground flex flex-col items-center py-12 px-4">
      <div className="text-center mb-12 max-w-3xl">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
          Flexible Plans for Every Educator
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          Choose the perfect plan for your teaching needs. All plans include a 14-day free trial.
        </p>

        {/* Audience Toggle */}
        <div className="inline-flex bg-muted p-1 rounded-lg mb-8">
          {[
            { id: "individual", label: "Teachers", icon: <Users size={18} /> },
            { id: "institute", label: "Institutes", icon: <Building size={18} /> },
            { id: "school", label: "Schools", icon: <School size={18} /> },
          ].map((item) => (
            <button
              key={item.id}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                audience === item.id
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setAudience(item.id)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span className={`text-sm ${billingPeriod === "monthly" ? "font-semibold" : "text-muted-foreground"}`}>
            Monthly
          </span>
          <div 
            className="w-12 h-6 flex items-center bg-gradient-to-r from-blue-500 to-purple-500 rounded-full p-1 cursor-pointer"
            onClick={() => setBillingPeriod(billingPeriod === "monthly" ? "yearly" : "monthly")}
          >
            <div
              className={`bg-white dark:bg-slate-900 h-4 w-4 rounded-full shadow-md transform transition-transform ${
                billingPeriod === "yearly" ? "translate-x-6" : ""
              }`}
            />
          </div>
          <div className="flex items-center">
            <span className={`text-sm ${billingPeriod === "yearly" ? "font-semibold" : "text-muted-foreground"}`}>
              Yearly
            </span>
            <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
              Save 17%
            </span>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl w-full">
        {plans[audience].map((plan, idx) => (
          <div
            key={idx}
            className={`relative rounded-2xl p-8 flex flex-col h-full transition-all duration-300 ${
              plan.popular
                ? "border-2 border-blue-500 shadow-2xl shadow-blue-500/20 bg-background scale-105"
                : "border border-border bg-background shadow-lg hover:shadow-xl"
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-semibold px-4 py-1 rounded-full flex items-center">
                  <Star size={12} className="mr-1 fill-white" />
                  MOST POPULAR
                </span>
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <p className="text-muted-foreground mb-4">{plan.description}</p>
              <div className="flex items-baseline mb-2">
                <span className="text-4xl font-bold">
                  {plan.price[billingPeriod]}
                </span>
                <span className="text-muted-foreground ml-2">
                  {billingPeriod === "monthly" ? "/month" : "/year"}
                </span>
              </div>
              {billingPeriod === "yearly" && (
                <p className="text-green-600 text-sm font-medium">
                  Save ₹{parseInt(plan.price.monthly.replace(/\D/g, "")) * 12 - parseInt(plan.price.yearly.replace(/\D/g, ""))} annually
                </p>
              )}
            </div>

            <ul className="space-y-3 mb-8 flex-grow">
              {plan.features.map((feature, fidx) => (
                <li key={fidx} className="flex items-start">
                  <Check className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            <button
              className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
                plan.popular
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                  : "bg-gradient-to-r from-slate-100 to-slate-200 text-slate-800 hover:from-slate-200 hover:to-slate-300 dark:from-slate-800 dark:to-slate-700 dark:text-white dark:hover:from-slate-700 dark:hover:to-slate-600"
              }`}
              onClick={() => navigate("/payment")}
            >
              {plan.popular ? "Get Started" : "Choose Plan"}
            </button>
          </div>
        ))}
      </div>

      {/* FAQ Section */}
      <div className="mt-16 max-w-4xl w-full">
        <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            {
              question: "Can I change plans anytime?",
              answer: "Yes, you can upgrade or downgrade your plan at any time."
            },
            {
              question: "Is there a free trial?",
              answer: "Yes, all plans include a 14-day free trial with full access to features."
            },
            {
              question: "What payment methods do you accept?",
              answer: "We accept all major credit cards, UPI, Net Banking, and bank transfers."
            },
            {
              question: "Do you offer educational discounts?",
              answer: "Yes, we offer special pricing for non-profits and educational institutions."
            }
          ].map((faq, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow">
              <h3 className="font-semibold mb-2">{faq.question}</h3>
              <p className="text-muted-foreground text-sm">{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}