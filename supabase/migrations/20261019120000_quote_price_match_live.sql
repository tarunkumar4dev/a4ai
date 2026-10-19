-- 20261019120000_quote_price_match_live.sql
-- Records quote_price() exactly as it runs on live (checked read-only on 19 Oct 2026).
-- 20261017120000_coupons.sql has a stricter version (login required, anon revoked), but live runs this one:
-- logged-out visitors on /payment (e.g. a ?coupon=AMANX50 link) can preview the discounted price.
-- Running this on live changes nothing. A fresh database built from the repo then matches production.
--
-- Trade-off kept on purpose: anyone can test coupon codes without logging in (a4_quote_price only reveals
-- whether a code is valid and its price; per-user limits are still enforced at create-order, which needs a
-- login). To require login instead, run the quote_price block from 20261017120000_coupons.sql plus
--   revoke execute on function public.quote_price(text, text, text) from anon;
-- and expect logged-out coupon links to show "Invalid or expired coupon code".

begin;

create or replace function public.quote_price(
  p_plan_slug text,
  p_cycle text,
  p_coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return a4_quote_price(auth.uid(), p_plan_slug, p_cycle, p_coupon_code);
end;
$$;

grant execute on function public.quote_price(text, text, text) to anon, authenticated, service_role;

commit;

-- VERIFY (every row true)
-- select 'quote_price callable by anon' as check, has_function_privilege('anon', 'public.quote_price(text,text,text)', 'EXECUTE') as ok
-- union all select 'a4_quote_price NOT callable by anon', not has_function_privilege('anon', 'public.a4_quote_price(uuid,text,text,text)', 'EXECUTE')
-- union all select 'a4_quote_price NOT callable by authenticated', not has_function_privilege('authenticated', 'public.a4_quote_price(uuid,text,text,text)', 'EXECUTE')
-- union all select 'AMANX50 starter monthly = 9900', (public.a4_quote_price(null, 'starter', 'monthly', 'AMANX50') ->> 'final_paise')::int = 9900;

-- ROLLBACK: nothing to undo on live (same definition and grants as before).
