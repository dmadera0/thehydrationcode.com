# Affiliate programs — status and rules

## Program status

| Program | Status | Notes |
|---|---|---|
| Amazon Associates | **Not applied** | Apply only after 12+ published articles. See timing below. |
| ShareASale | Not applied | Several glass bottle merchants. Apply per-merchant. |
| Impact Radius | Not applied | Higher-value direct brands. |
| Direct (bkr, Klean Kanteen, Hydro Flask, Lifefactory, S'well) | Not applied | Typically 8–15%, versus Amazon's 3–4.5%. Priority once traffic exists. |

## Amazon timing — do not apply early

Approval is provisional. The clock starts at signup, not launch: you get 180
days to refer **three qualifying sales**, after which Amazon reviews and
decides. Miss it and the account closes permanently — that ID cannot be
reinstated, though you may reapply from scratch.

Amazon also requires the site to have **at least 10 original posts**, the most
recent published within 60 days, and be publicly accessible.

So: publish 12–15 articles, get indexed, confirm organic traffic is arriving,
*then* apply. Applying to an empty site burns the one clean attempt.

## The price rule

Amazon's Operating Agreement prohibits displaying Amazon prices unless sourced
from the Product Advertising API and refreshed within 24 hours. PA-API access
is not granted until after the three qualifying sales.

Consequence: **Amazon products show "Check price ↗", never a dollar figure.**
Enforced in `src/lib/pricing.ts`. Non-Amazon merchants may show a price range
with an "as of" date.

When PA-API access arrives, implement `fetchLivePrice()` and flip the affected
bottles to `priceDisplay: 'exact'`. No component changes needed.

## Disclosure requirements

FTC requires disclosure be unavoidable — not buried in a footer.

1. Above the first affiliate link on any page containing one
2. In the site footer
3. On a dedicated `/affiliate-disclosure` page

Amazon additionally requires the phrase "As an Amazon Associate I earn from
qualifying purchases" once the account is live.

## Adding a link

1. Add an entry to `src/data/affiliates.ts`
2. Reference it by id from the bottle's `affiliateId`
3. Render only through `<AffiliateLink>`

Never write a merchant URL anywhere else. The registry exists so a tag change
is a one-file edit.
