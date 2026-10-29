// CookiePolicyPage.tsx — what a4ai stores in the browser and why.
import { Link } from "react-router-dom";
import LegalLayout, { LegalSection } from "./LegalLayout";

const ROWS = [
  {
    what: "Sign-in session",
    where: "Browser storage (a4ai.auth.token)",
    why: "Keeps you signed in. Without it you can't use your dashboard.",
    kind: "Essential",
  },
  {
    what: "Your settings",
    where: "Browser storage",
    why: "Remembers small choices — for example where to send you after signing in, or an unsent upload on a student link.",
    kind: "Essential",
  },
  {
    what: "Google Analytics",
    where: "Cookies (_ga, _ga_*)",
    why: "Counts visits and pages viewed so we know what to improve. Not used for ads.",
    kind: "Analytics",
  },
  {
    what: "Vercel Analytics",
    where: "No cookies",
    why: "Page-load speed and visit counts, without identifying you.",
    kind: "Analytics",
  },
  {
    what: "Razorpay",
    where: "Cookies set by Razorpay",
    why: "Only on the payment page, to process your payment securely.",
    kind: "Essential (payments)",
  },
];

export default function CookiePolicyPage() {
  return (
    <LegalLayout
      title="Cookie Policy"
      updated="Updated: 26 October 2026"
      description="What a4ai stores in your browser — sign-in, settings and analytics — and how to control it."
      path="/cookies"
    >
      <LegalSection title="In short">
        <p>
          a4ai stores a small amount of information in your browser to keep you signed in and remember your settings,
          and uses analytics to understand how the site is used. We don't use advertising cookies and we don't sell
          your data.
        </p>
      </LegalSection>

      <LegalSection title="What we store">
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-[14px]">
            <thead>
              <tr className="border-b border-[#E5E7EB] text-[#1B1B1B]">
                <th className="px-1 py-2 font-semibold">What</th>
                <th className="px-1 py-2 font-semibold">Where</th>
                <th className="px-1 py-2 font-semibold">Why</th>
                <th className="px-1 py-2 font-semibold">Type</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.what} className="border-b border-[#F0F1F3] align-top">
                  <td className="px-1 py-2.5 font-semibold text-[#1B1B1B]">{r.what}</td>
                  <td className="px-1 py-2.5">{r.where}</td>
                  <td className="px-1 py-2.5">{r.why}</td>
                  <td className="px-1 py-2.5 whitespace-nowrap">{r.kind}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection title="Controlling cookies">
        <p>
          You can block or delete cookies and site data in your browser settings. If you block essential storage you
          will be signed out and some features will stop working. Blocking analytics cookies doesn't affect how a4ai
          works.
        </p>
      </LegalSection>

      <LegalSection title="More">
        <p>
          How we handle personal data is explained in our <Link to="/privacy">Privacy Policy</Link>. Questions? Email{" "}
          <a href="mailto:a4ai.team@gmail.com">a4ai.team@gmail.com</a>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
